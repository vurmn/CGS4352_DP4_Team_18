// demo account that exists on first run (jordan is our persona). store.js hashes the password when it adds it.
(function () {
  const NC = (window.NC = window.NC || {});

  NC.seedUsers = [
    {
      id: 'u-jordan',
      name: 'Jordan Kim',
      email: 'jordan@example.com',
      password: 'needcheck',
      // jordan's receipts go back months, so "member since" shouldn't say today
      createdAt: new Date(Date.now() - 240 * 86400000).toISOString(),
    },
  ];
})();
