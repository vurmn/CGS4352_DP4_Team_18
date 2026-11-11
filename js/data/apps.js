// The made-up apps and sites that show up across NeedCheck, plus the kinds of data
// they can ask for. Requests, receipts and rules all point back to this list by id.
// NC is the shared object every file adds to
(function () {
  const NC = (window.NC = window.NC || {});

  // Fields for each app:
  // id - used by other files to look the app up
  // name, category - shown on screen
  // kind - 'app' or 'site'
  // color, icon - the colored tile next to the name
  // rulesCategory - which privacy rule group it falls under (Rules tab)
  // contact - privacy email, used when asking an app to delete data
  const apps = [
    { id: 'temple-run', name: 'Temple Run', category: 'Game', kind: 'app', color: '#1B2340', icon: 'game', rulesCategory: 'games', contact: 'privacy@templerun.com' },
    { id: 'walmart', name: 'Walmart', category: 'Shopping', kind: 'site', color: '#2C7A7B', icon: 'bag', rulesCategory: 'shopping', contact: 'privacy@walmart.com' },
    { id: 'quizlet', name: 'Quizlet', category: 'Study app', kind: 'app', color: '#6B5BA8', icon: 'book', rulesCategory: 'other', contact: 'privacy@quizlet.com' },
    { id: 'adidas', name: 'Adidas', category: 'Fitness', kind: 'app', color: '#B04A6A', icon: 'heart', rulesCategory: 'other', contact: 'privacy@adidas.com' },
    { id: 'snapchat', name: 'Snapchat', category: 'Social', kind: 'app', color: '#D07A2B', icon: 'camera', rulesCategory: 'social', contact: 'privacy@snapchat.com' },
    { id: 'doordash', name: 'DoorDash', category: 'Food delivery', kind: 'app', color: '#B4471E', icon: 'food', rulesCategory: 'food', contact: 'privacy@doordash.com' },
    { id: 'chase', name: 'Chase Bank', category: 'Bank', kind: 'app', color: '#2F5D8A', icon: 'bank', rulesCategory: 'other', contact: 'privacy@chase.com' },
    { id: 'cnn', name: 'CNN', category: 'News site', kind: 'site', color: '#3F4B3B', icon: 'news', rulesCategory: 'news', contact: 'privacy@cnn.com' },
    { id: 'accuweather', name: 'AccuWeather', category: 'Weather', kind: 'app', color: '#3D7EA6', icon: 'sun', rulesCategory: 'other', contact: 'privacy@accuweather.com' },
    { id: 'uber', name: 'Uber', category: 'Rides', kind: 'app', color: '#2E6B4F', icon: 'car', rulesCategory: 'maps', contact: 'privacy@uber.com' },
    { id: 'spotify', name: 'Spotify', category: 'Music', kind: 'app', color: '#7A3E8E', icon: 'music', rulesCategory: 'other', contact: 'privacy@spotify.com' },
    { id: 'candy-crush', name: 'Candy Crush', category: 'Game', kind: 'app', color: '#C2672E', icon: 'star', rulesCategory: 'games', contact: 'privacy@candycrush.com' },
    { id: 'shein', name: 'Shein', category: 'Clothing store', kind: 'site', color: '#8B5A3C', icon: 'bag', rulesCategory: 'shopping', contact: 'privacy@shein.com' },
    { id: 'canvas', name: 'Canvas', category: 'School portal', kind: 'site', color: '#4F6FA8', icon: 'school', rulesCategory: 'other', contact: 'privacy@canvas.com' },
    { id: 'google-maps', name: 'Google Maps', category: 'Maps', kind: 'app', color: '#3E8E6A', icon: 'map', rulesCategory: 'maps', contact: 'privacy@google.com' },
  ];
  // turns the list into a lookup by id 
  NC.apps = {};
  apps.forEach((a) => { NC.apps[a.id] = a; });

  // Never let a bad id crash a screen, just show something neutral.
  NC.app = function (id) {
    return NC.apps[id] || { id: id, name: id || 'Unknown app', category: 'App', kind: 'app', color: '#57534A', icon: 'globe', rulesCategory: 'other', contact: '' };
  };
  // the label and icon are what user sees
  // types of data a app can ask for 
  NC.dataTypes = {
    location: { label: 'Location', icon: 'pin' },
    contacts: { label: 'Contacts', icon: 'users' },
    notifications: { label: 'Notifications', icon: 'bell' },
    email: { label: 'Email', icon: 'mail' },
    phone: { label: 'Phone number', icon: 'phone' },
    birthday: { label: 'Birthday', icon: 'cake' },
    adCookies: { label: 'Ad cookies', icon: 'cookie' },
    analyticsCookies: { label: 'Analytics cookies', icon: 'cookie' },
    loginCookies: { label: 'Login cookies', icon: 'lock' },
    health: { label: 'Health data', icon: 'heart' },
    photos: { label: 'Photos', icon: 'photo' },
    camera: { label: 'Camera', icon: 'camera' },
    microphone: { label: 'Microphone', icon: 'mic' },
    files: { label: 'Files you uploaded', icon: 'file' },
    marketing: { label: 'Marketing emails', icon: 'mail' },
    orders: { label: 'Order history', icon: 'bag' },
    payment: { label: 'Payment card', icon: 'card' },
    account: { label: 'Your account', icon: 'user' },
  };
   // Get a data types label and icon by its key
  // If the key isn't in the list, show the key itself so nothing breaks
  NC.dataType = function (key) {
    return NC.dataTypes[key] || { label: key, icon: 'info' };
  };
})();
