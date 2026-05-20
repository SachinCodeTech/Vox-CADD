// Capacitor Configuration for VoxCADD Professional mobilised hybrid package.
// Explicitly typed as any or type-free to avoid compile-time dependencies on @capacitor/cli during web linting.

const config = {
  appId: 'com.voxcadd.professional',
  appName: 'VoxCADD Pro',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_status_icon',
      iconColor: '#00bcd4'
    }
  }
};

export default config;
