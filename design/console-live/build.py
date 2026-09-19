import base64,sys,os
d=os.path.dirname(os.path.abspath(__file__))
shell=open(d+'/shell.html').read()
def logo(p): return 'data:image/svg+xml;base64,'+base64.b64encode(open(p,'rb').read()).decode()
out=(shell.replace('{{CSS}}',open(d+'/styles.css').read())
          .replace('{{JS}}',open(d+'/app.js').read())
          .replace('{{LOGO_DARK}}',logo('/root/shroti-host-repo/public/logo-on-dark.svg'))
          .replace('{{LOGO_LIGHT}}',logo('/root/shroti-host-repo/public/logo-on-light.svg')))
open(d+'/index.html','w').write(out); print(len(out),'bytes')
