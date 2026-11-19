import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

const NOTIFICATION_ID = 101;
const TEST_NOTIFICATION_ID = 102;

export const notificationService = {
  /**
   * Check and request notification permissions
   */
  async requestPermissions(): Promise<boolean> {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await LocalNotifications.checkPermissions();
        if (status.display === 'granted') return true;
        const req = await LocalNotifications.requestPermissions();
        return req.display === 'granted';
      }

      // Web fallback
      if ('Notification' in window) {
        if (Notification.permission === 'granted') return true;
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      }

      return false;
    } catch (err) {
      console.warn('Error requesting notification permissions:', err);
      return false;
    }
  },

  /**
   * Schedule or update a recurring daily reminder
   * @param timeStr e.g., "20:30" or "20:30:00"
   * @param enabled whether the reminder should be active
   */
  async scheduleDailyReminder(timeStr: string = '20:30', enabled: boolean = true): Promise<boolean> {
    try {
      // Cancel previous scheduled notification first
      await this.cancelDailyReminder();

      if (!enabled) {
        return true;
      }

      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.warn('Notification permission was not granted.');
        return false;
      }

      const parts = timeStr.split(':');
      const hour = parseInt(parts[0], 10) || 20;
      const minute = parseInt(parts[1], 10) || 30;

      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: NOTIFICATION_ID,
              title: '🥛 Milk Delivery Reminder',
              body: "Don't forget to log today's milk delivery in Milk Expense Tracker!",
              schedule: {
                on: {
                  hour,
                  minute,
                },
                allowWhileIdle: true,
              },
              sound: undefined,
              actionTypeId: '',
              extra: {
                type: 'daily_milk_reminder',
              },
            },
          ],
        });
        console.log(`Scheduled native daily reminder for ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      } else {
        console.log(`Web platform: Daily reminder set for ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
      }

      return true;
    } catch (err) {
      console.error('Failed to schedule daily reminder:', err);
      return false;
    }
  },

  /**
   * Cancel the recurring daily reminder
   */
  async cancelDailyReminder(): Promise<void> {
    try {
      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.cancel({
          notifications: [{ id: NOTIFICATION_ID }],
        });
      }
    } catch (err) {
      console.warn('Error canceling daily reminder:', err);
    }
  },

  /**
   * Send an immediate test notification to verify device/browser setup
   */
  async sendTestNotification(): Promise<boolean> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        alert('Notification permission was denied. Please allow notifications in your device or browser settings.');
        return false;
      }

      if (Capacitor.isNativePlatform()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              id: TEST_NOTIFICATION_ID,
              title: '🥛 Milk Tracker Test Notification',
              body: 'Daily reminders are configured and working perfectly!',
              schedule: { at: new Date(Date.now() + 1500) }, // 1.5s delay
            },
          ],
        });
      } else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('🥛 Milk Tracker Test Notification', {
          body: 'Daily reminders are configured and working on this browser!',
          icon: '/milk-icon.png',
        });
      }

      return true;
    } catch (err) {
      console.error('Failed to send test notification:', err);
      return false;
    }
  },
};
