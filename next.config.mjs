/**
 * An API server with one static status page. Nothing is framed, nothing is
 * loaded from elsewhere, so the policy can be as tight as a policy gets.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The operator console is the site's home page: a static file
  // (public/console/index.html) that reads everything through the
  // session-authenticated /api/console/* routes.
  async rewrites() {
    return { beforeFiles: [{ source: "/", destination: "/console/index.html" }] };
  },
  async redirects() {
    return [{ source: "/console", destination: "/", permanent: false }];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "content-security-policy", value: csp },
        { key: "x-content-type-options", value: "nosniff" },
        { key: "referrer-policy", value: "no-referrer" },
        { key: "strict-transport-security", value: "max-age=63072000; includeSubDomains" },
        { key: "permissions-policy", value: "camera=(), microphone=(), geolocation=()" },
      ],
    }];
  },
};

export default nextConfig;
