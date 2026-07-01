// Preload runs in an isolated context and exposes ONLY a tiny, safe license API
// to the activation screen. No Node access leaks to the page.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('lic', {
  info: () => ipcRenderer.invoke('lic:info'),
  copy: (text) => ipcRenderer.invoke('lic:copy', text),
  submit: (text) => ipcRenderer.invoke('lic:submit', text),
})
