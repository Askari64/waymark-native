const { withAndroidManifest } = require('expo/config-plugins');
module.exports = config => withAndroidManifest(config, config => {
 const app = config.modResults.manifest.application[0];
 app.$['android:allowBackup']='false';
 delete app.$['android:fullBackupContent'];
 delete app.$['android:dataExtractionRules'];
 return config;
});
