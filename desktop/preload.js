const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('NovaBluDesktop', {
  platform: process.platform,
  isDesktop: true,
  version: '0.14'
});
