# Sales Performance Dashboard – Netlify version

Files
- public/index.html            the dashboard (all HTML/CSS/JS)
- netlify/functions/data.mjs   tiny API that saves/loads shared data in Netlify Blobs
- netlify.toml, package.json   Netlify settings and the one dependency (@netlify/blobs)

Deploy (Git method – recommended, because Netlify installs the dependency for you)
1. Create a GitHub repo and upload everything in this folder (keep the folder structure).
2. Netlify: Add new site > Import an existing project > pick the repo. Settings are read from netlify.toml. Click Deploy.
3. Site configuration > Environment variables, add:
     EDITOR_PASSWORD  = (a password only you/managers know)   <- required to save data
     VIEWER_PASSWORD  = (optional) if set, viewers must also enter a password to see the data
4. Deploys > Trigger deploy > Deploy site (environment variables only apply to new deploys).
5. Open your site, go to the Data tab, type the editor password, click Sign in, load your Excel
   file, then click "Save to shared dashboard". Everyone who opens the site now sees that data.
6. Custom domain: Domain management > Add a domain.

Deploy with the CLI instead
   npm install
   npm install -g netlify-cli
   netlify login
   netlify deploy --prod
(then add the environment variables in step 3 and redeploy)

Notes
- Viewers see updates automatically (the page checks every 30 seconds).
- Save limit: a single save must be under about 6 MB (roughly 40,000+ daily rows) – plenty for 16 employees.
- Use HTTPS (Netlify does by default); passwords are sent in a request header.
- Quintiles and targets edited by an editor are saved automatically after about a second.
