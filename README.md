# NeedCheck

NeedCheck is a phone web app that helps young adults see what apps and sites ask for, decide what to share,
and take back what they already shared. It is our DP4 high-fidelity prototype for CS 4352 (Team 18).

**Live app:** https://vurmn.github.io/CGS4352_DP4_Team_18/

**Code:** https://github.com/vurmn/CGS4352_DP4_Team_18

**Everything in the app is made up for a class demo.** The apps, requests, receipts and company practices are
example data. Nothing is sent anywhere: accounts and choices are saved only in your own browser (localStorage).

## Try it

- **On a phone:** open the live link and use it like any app. You can also add it to your home screen
  (Safari: Share > Add to Home Screen, Chrome: menu > Add to Home screen) so it opens full screen.
- **On a laptop:** the app shows inside a phone frame. The side panel has a QR code to open it on your phone
  and a button to reset the demo data.
- **From the code:** download the repo and open `index.html` in Chrome, Safari or Firefox. No install and no
  build step. To match GitHub Pages exactly you can also run `python3 -m http.server` in this folder.

Test account: `jordan@example.com` / `needcheck` (the login screen has a "Use the demo account" button too).
You can sign up with any email as well; every account gets its own fresh copy of the demo data.

## The three tasks

1. **Decide what a new game gets** (simple). On Home, tap "Temple Run is asking for 4 things", then
   "Allow only what's needed".
2. **Set up your privacy rules** (moderate). Open the Rules tab, tap "Set up my rules" and go through cookie
   banners, contact info and location, then save.
3. **Clean up after a shopping site** (complex). Open Receipts, find Walmart, take back what it doesn't need,
   send a delete request and make it a rule for shopping sites.

Account > Reset demo data puts every task back to the start (your account stays).

## How the code is laid out

Plain HTML, CSS and JavaScript, no framework and no build. Every script is a small file that registers its
screens with the router, and `js/app.js` starts the app once they are all loaded.

| Who | Part | Files |
|---|---|---|
| Danyal Nawab | App shell, navigation, look and feel | `index.html`, `css/base.css`, `css/controls.css`, `js/core/dom.js`, `js/core/icons.js`, `js/core/controls.js`, `js/core/router.js`, `js/app.js`, `assets/`, `manifest.webmanifest` |
| Umair Malik | Accounts, saved data, pop-ups | `js/core/store.js`, `js/core/ui.js`, `css/overlays.css`, `js/data/users.js`, `js/screens/account.js`, `css/account.css` |
| Bianca Hernandez | Home, Task 1 and the help pop-ups | `js/data/apps.js`, `js/data/requests.js`, `js/screens/home.js`, `css/home.css`, `js/screens/check.js`, `css/check.css`, `js/screens/help.js`, `css/help.css` |
| Tri Nguyen | Task 2 and the delete request | `js/data/rules.js`, `js/screens/rules.js`, `css/rules.css`, `js/screens/requests.js`, `css/requests.css` |
| Nicolas Price | Task 3 receipts and the welcome tour | `js/data/receipts.js`, `js/screens/receipts.js`, `css/receipts.css`, `js/screens/onboarding.js`, `css/onboarding.css` |

The app still runs when only some of these files are there (each part checks for the others before using
them), which is how we pushed it to GitHub one part at a time.

`.nojekyll` tells GitHub Pages to serve the files as they are.
