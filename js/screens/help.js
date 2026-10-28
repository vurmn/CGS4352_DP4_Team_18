// Help pop-ups: the plain-words sheets that open when a word like "masking" or "ad cookies" needs explaining,
// plus the "How we rate apps" sheet. DP3 problems 2 and 9: people didn't get "masking" or what some switches did.
(function () {
  const NC = (window.NC = window.NC || {});
  if (!NC.dom || !NC.c) return;

  const { h } = NC.dom;
  const c = NC.c;

  function icon(name, size) {
    return NC.icon(name, { size: size || 20 });
  }

  // The masking examples show the person their own stand-in details, so it feels like their app and not a manual
  function masked() {
    let m = null;
    try {
      if (NC.rules && typeof NC.rules.masked === 'function') m = NC.rules.masked();
      else {
        const r = NC.rules && typeof NC.rules.get === 'function' ? NC.rules.get() : NC.store && NC.store.get('rules');
        m = r && r.masked;
      }
    } catch (e) {
      m = null;
    }
    if (m && m.email && m.phone) return m;
    // Until the rules part is in, we show a made-up stand-in that looks like the real one
    const user = NC.store && NC.store.currentUser();
    const parts = String((user && user.name) || 'Jordan Kim').toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
    const local = (parts[0] || 'you') + (parts.length > 1 ? '.' + parts[parts.length - 1][0] : '') + '7';
    return { email: local + '@relay.needcheck.app', phone: '(469) 555-0147' };
  }

  // Short and concrete, with an app from the demo in every example, so people can picture it right away
  const RATINGS = {
    needed: {
      meaning: "The app can't do its main job without it. Saying no usually means a feature stops working.",
      example: 'DoorDash needs your location to bring food to your door.',
    },
    optional: {
      meaning: "It adds something extra, but the app works fine without it. It's up to you.",
      example: 'AccuWeather can send severe weather alerts if you allow notifications. You can still check the forecast without them.',
    },
    not_needed: {
      meaning: "The app doesn't need it for what it does. It's often used for ads or tracking, so saying no is usually safe.",
      example: 'Temple Run asks for your contacts, but the game plays exactly the same without them.',
    },
  };

  const TERMS = {
    masking: () => ({
      icon: 'mask',
      title: 'What does masking mean?',
      text: 'Masking means a site gets a stand-in email or phone number instead of your real one. Anything they send still reaches you, but they never learn your real details. You can switch it off any time.',
      example: 'Walmart gets ' + masked().email + ". Order emails still land in your inbox, and if Walmart shares its mailing list, your real address isn't on it.",
    }),
    adCookies: () => ({
      icon: 'cookie',
      title: 'What are ad cookies?',
      text: "Little files a site leaves in your browser so ad companies can recognize you on other sites and show you ads based on what you looked at. Saying no doesn't break the site.",
      example: 'You look at running shoes on Adidas. For the next week, the same shoes follow you around on news sites.',
    }),
    analyticsCookies: () => ({
      icon: 'cookie',
      title: 'What are analytics cookies?',
      text: 'They count how people use a site: which pages you open, how long you stay and what you tap. Sites use this to improve, and some share it with partners.',
      example: 'CNN learns you read three articles and left after 4 minutes. With these off, you can still read everything.',
    }),
    loginCookies: () => ({
      icon: 'lock',
      title: 'What are login cookies?',
      text: "They remember that you're logged in and what's in your cart, so a site works normally. These are the ones worth keeping.",
      example: 'Without them, Walmart would forget your cart and ask you to log in again on every page.',
    }),
    sneakyBanners: () => ({
      icon: 'alert',
      title: 'What is a sneaky cookie banner?',
      text: 'A cookie pop-up that makes saying no hard on purpose, with a tiny or hidden "Decline" or extra screens to get through. NeedCheck flags these so you know.',
      example: 'A banner shows a big bright "Accept all" button, while "Manage options" sits in small gray text and takes three more taps to say no.',
    }),
    optionalFields: () => ({
      icon: 'edit',
      title: 'What are optional fields?',
      text: "Boxes on a sign-up form you don't have to fill in, like your birthday or gender. Sites often use them for ads, and skipping them doesn't stop you signing up.",
      example: 'Shein asks for your birthday when you sign up. You can leave it empty and still shop and check out.',
    }),
    receipt: () => ({
      icon: 'receipt',
      title: "What's a receipt?",
      text: 'A record NeedCheck keeps every time you say yes to an app or site: what you shared, when, and what they do with it. Open one any time to take something back.',
      example: 'Your Walmart receipt shows they have your email, phone number and birthday, and lets you mask your phone number.',
    }),
    rule: () => ({
      icon: 'rules',
      title: "What's a rule?",
      text: "A choice you make once that NeedCheck then uses for you, so you don't answer the same pop-up again and again. You can turn any rule off later.",
      example: 'Your rule says no to ad cookies. Next time CNN shows a cookie banner, NeedCheck declines the ads for you and keeps you logged in.',
    }),
    deleteRequest: () => ({
      icon: 'trash',
      title: "What's a delete request?",
      text: 'A message asking a company to erase the data it has about you. NeedCheck writes it for you and keeps track of the reply. Companies usually have 45 days to answer.',
      example: 'You ask Walmart to delete your birthday and phone number. Your Walmart receipt shows the request and how many days they have left.',
    }),
    needed: () => ({ verdict: 'needed', title: 'What does "Needed" mean?', text: RATINGS.needed.meaning, example: RATINGS.needed.example }),
    optional: () => ({ verdict: 'optional', title: 'What does "Optional" mean?', text: RATINGS.optional.meaning, example: RATINGS.optional.example }),
    notNeeded: () => ({ verdict: 'not_needed', title: 'What does "Not needed" mean?', text: RATINGS.not_needed.meaning, example: RATINGS.not_needed.example }),
  };

  // Screens might call the same word a few different things, and they should all open the same pop-up
  const ALIASES = {
    mask: 'masking',
    masked: 'masking',
    placeholder: 'masking',
    placeholders: 'masking',
    not_needed: 'notNeeded',
    'not-needed': 'notNeeded',
    sneaky: 'sneakyBanners',
    optionalField: 'optionalFields',
    delete: 'deleteRequest',
    receipts: 'receipt',
    rules: 'rule',
  };

  const VERDICT_TONE = { needed: 'green', optional: 'amber', not_needed: 'red' };
  const VERDICT_ICON = { needed: 'check', optional: 'minus', not_needed: 'x' };

  // Hands back the sheet so the screen that opened it can close it. A word we don't have gives null,
  // so that screen can show its own explanation instead of leaving the person with nothing
  function explain(term) {
    const key = TERMS[term] ? term : ALIASES[term];
    if (!key || !TERMS[key]) return null;
    return show(TERMS[key]());
  }

  // The same pop-up filled with a screen's own words ({ icon, title, text, example }), so every
  // info button in the app feels the same to the person tapping it, even for words not in the glossary
  function show(t) {
    if (!t || !t.title || !NC.ui || !NC.ui.sheet) return null;
    const top = t.verdict
      ? h('div.help-top', c.iconTile(VERDICT_ICON[t.verdict], { tone: VERDICT_TONE[t.verdict], size: 48 }), c.verdict(t.verdict))
      : h('div.help-top', c.iconTile(t.icon || 'info', { tone: 'peach', size: 48 }));
    return NC.ui.sheet({
      className: 'help-sheet',
      body: (sh) => [
        top,
        h('h2.title-lg.help-title', t.title),
        t.text ? h('p.help-text', t.text) : null,
        t.example ? h('div.help-example', h('p.help-label', 'For example'), h('p', t.example)) : null,
        // A rating pop-up offers the full ratings sheet for anyone who wants to compare all three
        t.verdict ? h('button.link.help-more', {
          type: 'button',
          onClick: () => {
            sh.close();
            showRatings();
          },
        }, 'See how we rate apps', icon('arrowRight', 16)) : null,
      ],
      footer: (sh) => c.button('Got it', { variant: 'dark', onClick: () => sh.close() }),
    });
  }

  // Opened from Account and from every Why pop-up, so people can always find out what the chips mean
  function showRatings() {
    if (!NC.ui || !NC.ui.sheet) return null;
    const block = (v) => h('div.rate-item',
      h('div.rate-chip', c.verdict(v)),
      h('p.rate-meaning', RATINGS[v].meaning),
      h('p.rate-example', h('span.rate-eg', 'For example: '), RATINGS[v].example));
    return NC.ui.sheet({
      className: 'help-sheet',
      body: [
        h('div.help-top', c.iconTile('checkCircle', { tone: 'peach', size: 48 })),
        h('h2.title-lg.help-title', 'How we rate apps'),
        h('p.help-text', 'For every ask, we look at what the app needs to do its main job and what similar apps ask for. Then we give it one of three ratings.'),
        h('div.rate-list', block('needed'), block('optional'), block('not_needed')),
        h('p.help-small', 'Each rating always has a word and an icon, not just a color. Tap any item in a request to see why it got its rating.'),
      ],
      footer: (sh) => c.button('Got it', { variant: 'dark', onClick: () => sh.close() }),
    });
  }

  // Other screens check that NC.help is here before using it, since this file comes in with the Home push
  NC.help = { showRatings, explain, show };
})();
