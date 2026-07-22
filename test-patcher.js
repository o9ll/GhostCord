const { app } = require('electron');
app.whenReady().then(() => {
    try {
        require('./dist/desktop/patcher.js');
        console.log("SUCCESS: Patcher loaded");
    } catch (e) {
        console.error("ERROR loading patcher:", e);
    }
    app.quit();
});
