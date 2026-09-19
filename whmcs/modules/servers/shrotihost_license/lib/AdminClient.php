<?php

namespace ShrotiHost\WHMCS\Licensing;

/**
 * Admin API client for the ShrotiHost Licensing Server.
 *
 * Every request is signed: timestamp + single-use nonce + method + path +
 * body hash, HMAC-SHA256 with the admin secret. The old server signed no
 * nonce, so a captured request could be replayed for five minutes; this
 * server refuses a replay.
 */
class AdminClient
{
    /** @var string */
    private $baseUrl;
    /** @var string */
    private $keyId;
    /** @var string */
    private $secret;
    /** @var int */
    private $timeout;

    public function __construct(string $baseUrl, string $keyId, string $secret, int $timeout = 20)
    {
        $this->baseUrl = rtrim($baseUrl, '/');
        $this->keyId = $keyId;
        $this->secret = $secret;
        $this->timeout = max(5, $timeout);
    }

    public static function fromSettings(): self
    {
        $s = Settings::addon();
        return new self($s['base_url'], $s['api_key'], $s['api_secret'], $s['request_timeout']);
    }

    public function configured(): bool
    {
        return $this->keyId !== '' && $this->secret !== '';
    }

    public function get(string $path, array $query = []): array
    {
        return $this->request('GET', $path . ($query ? '?' . http_build_query($query) : ''), null);
    }

    public function post(string $path, array $body = []): array
    {
        return $this->request('POST', $path, $body);
    }

    /**
     * @throws ApiException on any non-2xx, transport failure, or bad JSON.
     */
    public function request(string $method, string $pathAndQuery, ?array $body): array
    {
        if (!$this->configured()) {
            throw new ApiException('Licensing API credentials are not configured (Addons → ShrotiHost Licensing).', 'not_configured', 0, false);
        }
        $path = '/api/admin/' . ltrim($pathAndQuery, '/');
        $raw = ($method === 'GET' || $body === null) ? '' : (string) json_encode($body, JSON_UNESCAPED_SLASHES);
        $ts = (string) time();
        $nonce = rtrim(strtr(base64_encode(random_bytes(18)), '+/', '-_'), '=');
        $canonical = implode("\n", [$ts, $nonce, strtoupper($method), $path, hash('sha256', $raw)]);

        $ch = curl_init($this->baseUrl . $path);
        $opts = [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_HTTPHEADER => [
                'Accept: application/json',
                'Content-Type: application/json',
                'X-SHL-Key: ' . $this->keyId,
                'X-SHL-Timestamp: ' . $ts,
                'X-SHL-Nonce: ' . $nonce,
                'X-SHL-Signature: ' . hash_hmac('sha256', $canonical, $this->secret),
                'User-Agent: ShrotiHost-WHMCS-Licensing/2.0',
            ],
            CURLOPT_CONNECTTIMEOUT => 8,
            CURLOPT_TIMEOUT => $this->timeout,
            CURLOPT_SSL_VERIFYPEER => true,
            CURLOPT_SSL_VERIFYHOST => 2,
        ];
        if ($method !== 'GET') {
            $opts[CURLOPT_POSTFIELDS] = $raw;
        }
        curl_setopt_array($ch, $opts);
        $resp = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);

        if (function_exists('logModuleCall')) {
            $logged = $body;
            if (isset($logged['package_b64'])) {
                $logged['package_b64'] = '[' . strlen((string) $logged['package_b64']) . ' bytes]';
            }
            $redact = [];
            if (is_string($resp) && preg_match('/"license_key":"([^"]+)"/', $resp, $m)) {
                $redact[] = $m[1];
            }
            if (isset($body['license_key'])) {
                $redact[] = (string) $body['license_key'];
            }
            logModuleCall('shrotihost_license', $method . ' ' . $path, $logged, $resp, null, $redact);
        }

        if ($resp === false) {
            throw new ApiException('Could not reach the licensing server: ' . $err, 'unreachable', 0, true);
        }
        $json = json_decode((string) $resp, true);
        if (!is_array($json)) {
            throw new ApiException('Unexpected response from the licensing server (HTTP ' . $status . ').', 'bad_response', $status, $status >= 500);
        }
        if ($status < 200 || $status >= 300) {
            $e = isset($json['error']) && is_array($json['error']) ? $json['error'] : [];
            throw new ApiException(
                (string) ($e['message'] ?? ('Licensing server error (HTTP ' . $status . ').')),
                (string) ($e['code'] ?? 'http_' . $status),
                $status,
                !empty($e['retryable']) || $status >= 500
            );
        }
        return $json;
    }
}

class ApiException extends \RuntimeException
{
    /** @var string */
    public $errorCode;
    /** @var int */
    public $httpStatus;
    /** @var bool */
    public $retryable;

    public function __construct(string $message, string $code, int $httpStatus, bool $retryable)
    {
        parent::__construct($message);
        $this->errorCode = $code;
        $this->httpStatus = $httpStatus;
        $this->retryable = $retryable;
    }
}
