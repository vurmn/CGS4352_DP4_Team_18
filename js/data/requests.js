// The requests Jordan gets in the demo: four apps still waiting (Temple Run first) and a few older ones
// they already answered. Every ask has its own plain "why" so any row can open the Why pop-up.
(function () {
  const NC = (window.NC = window.NC || {});

  // Temple Run is the one we test with, so it goes first
  const WAITING = [
    {
      id: 'temple-run',
      appId: 'temple-run',
      kind: 'permissions',
      receivedDaysAgo: 0,
      isNew: true,
      context: 'Just installed',
      note: "Saying no to the red items won't limit any game features.",
      asks: [
        {
          type: 'location',
          verdict: 'not_needed',
          reason: 'For a nearby leaderboard',
          why: {
            want: "Your precise location, even when you're not playing.",
            because: 'To show players near you on a leaderboard.',
            ifNo: "The game still works. You'll see the global leaderboard instead.",
            similar: { yes: 2, total: 10, text: "8 of 10 similar games don't ask for location." },
          },
        },
        {
          type: 'contacts',
          verdict: 'not_needed',
          reason: 'To find friends who play',
          why: {
            want: 'Every name, number and email saved in your phone, even people who never play.',
            because: "To show which friends already play and send invites to the ones who don't.",
            ifNo: 'The game still works. You can still add friends by their username.',
            similar: { yes: 3, total: 10, text: "7 of 10 similar games don't ask for your contacts." },
          },
        },
        {
          type: 'notifications',
          verdict: 'optional',
          reason: 'Daily rewards and events',
          why: {
            want: 'Permission to send alerts to your lock screen.',
            because: 'To remind you about daily rewards and weekend events.',
            ifNo: "Your rewards still wait for you in the game. You just won't get pinged about them.",
            similar: { yes: 6, total: 10, text: "6 of 10 similar games ask for this. It's up to you." },
          },
        },
        {
          type: 'email',
          verdict: 'needed',
          reason: 'Saves your game progress',
          warn: 'Temple Run needs your email to save your progress. The game may not work without it.',
          why: {
            want: 'Your email address, so your game account belongs to you.',
            because: 'Your progress, coins and unlocked runners are saved to that account.',
            ifNo: "Your progress only lives on this phone. Delete the game or switch phones and it's gone.",
            similar: { yes: 9, total: 10, text: '9 of 10 similar games ask for an email to save your progress.' },
          },
        },
      ],
    },
    // A cookie banner, the kind of pop-up Tri's rules can answer for you
    {
      id: 'cnn',
      appId: 'cnn',
      kind: 'cookies',
      receivedDaysAgo: 1,
      isNew: false,
      context: 'Cookie banner on cnn.com',
      note: "Saying no to the red items won't change what you can read.",
      asks: [
        {
          type: 'adCookies',
          verdict: 'not_needed',
          reason: 'Ads that follow you to other sites',
          why: {
            want: 'To put ad trackers in your browser that note which stories you read.',
            because: 'Ad companies use them to guess what you like and show you ads about it on other sites.',
            ifNo: "Every article still loads. You'll still see ads, they just won't be based on what you read.",
            similar: { yes: 7, total: 10, text: '7 of 10 news sites ask for these, but none of them need them to work.' },
          },
        },
        {
          type: 'analyticsCookies',
          verdict: 'optional',
          reason: 'Counts visits to improve the site',
          why: {
            want: 'To count which pages you open and how long you stay on them.',
            because: 'So they can see which stories people read and fix pages that load slowly.',
            ifNo: 'Nothing changes for you. They just count one less visitor.',
            similar: { yes: 9, total: 10, text: '9 of 10 news sites use these. Saying no is always fine.' },
          },
        },
        {
          type: 'loginCookies',
          verdict: 'needed',
          // The one cookie a site really needs, so it's the only one we keep
          reason: 'Keeps you logged in',
          warn: "CNN needs login cookies to remember you. Without them you'll be logged out on every page.",
          why: {
            want: "A small file that remembers you're logged in and keeps your settings.",
            because: 'Without it the site forgets who you are every time you open a new page.',
            ifNo: "You'd have to log in again on every page, and your settings wouldn't stick.",
            similar: { yes: 10, total: 10, text: "All 10 similar sites use these. They're part of how logging in works." },
          },
        },
      ],
    },
    // Nothing here is needed, so "Allow only what's needed" shares nothing at all
    {
      id: 'accuweather',
      appId: 'accuweather',
      kind: 'permissions',
      receivedDaysAgo: 2,
      isNew: false,
      context: 'Opened for the first time',
      note: 'Both of these are up to you. The forecast works without them.',
      asks: [
        {
          type: 'location',
          verdict: 'optional',
          reason: 'Precise location for your street. Your city is enough',
          why: {
            want: 'Your exact location, all the time, even when the app is closed.',
            because: 'To show the forecast for your exact street and keep it updated as you move around.',
            ifNo: 'Type in your city or zip code instead. The forecast is the same for your whole area.',
            similar: { yes: 4, total: 10, text: '6 of 10 weather apps work fine with just your city.' },
          },
        },
        {
          type: 'notifications',
          verdict: 'optional',
          reason: 'Severe weather alerts',
          why: {
            want: 'Permission to send alerts to your lock screen.',
            because: 'To warn you about storms, flooding or extreme heat where you are.',
            ifNo: "You won't get storm alerts from this app. Your phone's emergency alerts still come through.",
            similar: { yes: 8, total: 10, text: '8 of 10 weather apps offer alerts like these.' },
          },
        },
      ],
    },
    // A second game, so "Always do this for games" has somewhere to show up next time
    {
      id: 'candy-crush',
      appId: 'candy-crush',
      kind: 'permissions',
      receivedDaysAgo: 3,
      isNew: false,
      context: 'Asked after an update',
      note: "Saying no to the red items won't limit any game features.",
      asks: [
        {
          type: 'contacts',
          verdict: 'not_needed',
          reason: 'To send lives to friends',
          why: {
            want: 'Your whole contact list: names, phone numbers and emails.',
            because: 'So you can invite people and trade extra lives with them.',
            ifNo: 'The game still works. You can still connect with friends who already play.',
            similar: { yes: 3, total: 10, text: "7 of 10 similar games don't ask for your contacts." },
          },
        },
        {
          type: 'photos',
          verdict: 'not_needed',
          reason: 'To share your high scores',
          why: {
            want: 'Access to every photo and screenshot on your phone.',
            because: 'So you can pick a picture when you share a score or change your profile picture.',
            ifNo: 'Sharing still works. Your phone lets you pick one photo at a time when you need it.',
            similar: { yes: 2, total: 10, text: "8 of 10 similar games don't ask for all your photos." },
          },
        },
        {
          type: 'notifications',
          verdict: 'optional',
          reason: 'When your lives refill',
          why: {
            want: 'Permission to send alerts to your lock screen.',
            because: 'To tell you when your lives are full again and when new levels come out.',
            ifNo: "You'll just check the game yourself to see if your lives are back.",
            similar: { yes: 7, total: 10, text: "7 of 10 similar games ask for this. It's up to you." },
          },
        },
      ],
    },
  ];

  // Older answers for the inbox. They're over a week old, so the "This week" numbers on Home start at 8 and 4
  const ANSWERED = [
    {
      id: 'spotify',
      appId: 'spotify',
      kind: 'permissions',
      receivedDaysAgo: 12,
      context: 'Asked after an update',
      note: "Saying no to the red items won't stop your music.",
      decided: { daysAgo: 12, mode: 'custom', allowed: ['notifications'] },
      asks: [
        {
          type: 'microphone',
          verdict: 'optional',
          reason: 'For voice search',
          why: {
            want: 'To use your microphone when you tap the voice search button.',
            because: 'So you can say a song name instead of typing it.',
            ifNo: 'Typing in the search bar works the same way.',
            similar: { yes: 5, total: 10, text: "5 of 10 music apps offer voice search. It's up to you." },
          },
        },
        {
          type: 'contacts',
          verdict: 'not_needed',
          reason: 'To find friends who listen',
          why: {
            want: 'Your whole contact list, to match it against people who use Spotify.',
            because: 'To suggest friends to follow and show what they listen to.',
            ifNo: 'Music plays the same. You can still follow friends by searching their name.',
            similar: { yes: 2, total: 10, text: "8 of 10 music apps don't ask for your contacts." },
          },
        },
        {
          type: 'notifications',
          verdict: 'optional',
          reason: 'New music from artists you follow',
          why: {
            want: 'Permission to send alerts to your lock screen.',
            because: 'To tell you when artists you follow drop something new.',
            ifNo: "You'll find new releases when you open the app instead.",
            similar: { yes: 9, total: 10, text: "9 of 10 music apps ask for this. It's up to you." },
          },
        },
      ],
    },
    {
      id: 'uber',
      appId: 'uber',
      kind: 'permissions',
      receivedDaysAgo: 18,
      context: 'Booked your first ride',
      note: 'Your location is the one thing rides really need.',
      decided: { daysAgo: 18, mode: 'needed', allowed: ['location'] },
      asks: [
        {
          type: 'location',
          verdict: 'needed',
          reason: 'So your driver can find you',
          warn: "Uber needs your location so drivers can find you. Without it you'll have to type every pickup spot.",
          why: {
            want: 'Your location while you have the app open.',
            because: 'Drivers need to know where to pick you up, and the app tracks the ride on the map.',
            ifNo: "You'd type your pickup address every time, and drivers may have a harder time finding you.",
            similar: { yes: 10, total: 10, text: "All 10 ride apps ask for this. It's how pickups work." },
          },
        },
        {
          type: 'contacts',
          verdict: 'not_needed',
          reason: 'To split fares with friends',
          why: {
            want: 'Your whole contact list.',
            because: 'To make it quicker to pick friends when you split a fare.',
            ifNo: 'You can still split a fare by typing a phone number.',
            similar: { yes: 3, total: 10, text: "7 of 10 ride apps don't ask for your contacts." },
          },
        },
        {
          type: 'notifications',
          verdict: 'optional',
          reason: 'Updates about your ride',
          why: {
            want: 'Permission to send alerts to your lock screen.',
            because: 'To tell you when your driver is close, plus some promos.',
            ifNo: 'Ride updates still show inside the app while you wait.',
            similar: { yes: 9, total: 10, text: "9 of 10 ride apps ask for this. It's up to you." },
          },
        },
      ],
    },
    // An old cookie banner they answered by hand, before rules existed
    {
      id: 'shein',
      appId: 'shein',
      kind: 'cookies',
      receivedDaysAgo: 25,
      context: 'Cookie banner on shein.com',
      note: "Saying no to the red items won't change what you can buy.",
      decided: { daysAgo: 25, mode: 'needed', allowed: ['loginCookies'] },
      asks: [
        {
          type: 'adCookies',
          verdict: 'not_needed',
          reason: 'Ads that follow you to other sites',
          why: {
            want: 'To put ad trackers in your browser that note what you look at.',
            because: 'So the clothes you looked at show up in ads on other sites and apps.',
            ifNo: "Shopping works the same. Ads just won't follow you around.",
            similar: { yes: 8, total: 10, text: '8 of 10 shopping sites ask for these, but none need them to work.' },
          },
        },
        {
          type: 'analyticsCookies',
          verdict: 'optional',
          reason: 'Counts visits to improve the site',
          why: {
            want: 'To count which pages you visit and what you tap on.',
            because: 'So they can see what shoppers do and fix pages that confuse people.',
            ifNo: 'Nothing changes for you. They just count one less visitor.',
            similar: { yes: 9, total: 10, text: '9 of 10 shopping sites use these. Saying no is always fine.' },
          },
        },
        {
          type: 'loginCookies',
          verdict: 'needed',
          reason: 'Keeps you logged in and your cart saved',
          warn: 'Shein needs login cookies to keep your cart. Without them your cart empties on every page.',
          why: {
            want: "A small file that remembers you're logged in and what's in your cart.",
            because: 'Without it the site forgets your cart every time you open a new page.',
            ifNo: "Your cart would empty itself and you'd have to log in again and again.",
            similar: { yes: 10, total: 10, text: "All 10 shopping sites use these. They're part of how carts work." },
          },
        },
      ],
    },
    {
      id: 'google-maps',
      appId: 'google-maps',
      kind: 'permissions',
      receivedDaysAgo: 33,
      context: 'First time getting directions',
      note: "Saying no to the red items won't change your directions.",
      decided: { daysAgo: 33, mode: 'needed', allowed: ['location'] },
      asks: [
        {
          type: 'location',
          verdict: 'needed',
          reason: 'To give you directions',
          warn: "Google Maps needs your location for turn-by-turn directions. Without it you'll only see the map.",
          why: {
            want: 'Your location while you use the app.',
            because: 'Directions start from where you are and update as you move.',
            ifNo: "You can still look at the map, but there's no blue dot and no turn-by-turn help.",
            similar: { yes: 10, total: 10, text: "All 10 map apps ask for this. It's how directions work." },
          },
        },
        {
          type: 'contacts',
          verdict: 'not_needed',
          reason: 'To share trips with friends',
          why: {
            want: 'Your whole contact list.',
            because: 'To make it quicker to send your arrival time to someone.',
            ifNo: 'You can still share a trip by picking a person when you need to.',
            similar: { yes: 3, total: 10, text: "7 of 10 map apps don't ask for your contacts." },
          },
        },
        {
          type: 'photos',
          verdict: 'optional',
          reason: 'To add photos to your reviews',
          why: {
            want: 'Access to the photos on your phone.',
            because: 'So you can add pictures when you review a place.',
            ifNo: 'Reviews still work. You can add photos one at a time later.',
            similar: { yes: 6, total: 10, text: "6 of 10 map apps ask for this. It's up to you." },
          },
        },
      ],
    },
  ];

  function copy(v) {
    return JSON.parse(JSON.stringify(v));
  }

  // The seed runs per user, so dates are always counted back from today
  function fresh() {
    const waiting = WAITING.map((r) => Object.assign(copy(r), { status: 'pending', decision: null }));
    const answered = ANSWERED.map((src) => {
      const r = copy(src);
      const d = r.decided;
      delete r.decided;
      const types = r.asks.map((a) => a.type);
      // A little after lunch on that day, so the inbox dates look like real ones
      const at = NC.dom ? NC.dom.daysAgo(d.daysAgo) : new Date(Date.now() - d.daysAgo * 86400000);
      at.setHours(13, 20, 0, 0);
      return Object.assign(r, {
        isNew: false,
        status: 'decided',
        decision: {
          at: at.toISOString(),
          mode: d.mode,
          allowed: types.filter((t) => d.allowed.includes(t)),
          declined: types.filter((t) => !d.allowed.includes(t)),
        },
      });
    });
    return {
      items: waiting.concat(answered),
      stats: { checkedBase: 8, declinedBase: 4 },
      lastUndo: null,
    };
  }

  if (NC.store && typeof NC.store.seed === 'function') NC.store.seed('requests', fresh);
})();
