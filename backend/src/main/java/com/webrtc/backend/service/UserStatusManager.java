package com.webrtc.backend.service;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.annotation.WebListener;

@WebListener
public class UserStatusManager implements ServletContextListener {

    private ScheduledExecutorService scheduler;

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        scheduler = Executors.newSingleThreadScheduledExecutor();
        // The task will start after a 0-second delay and then run every 1 minute.
        scheduler.scheduleAtFixedRate(new UserStatusUpdaterTask(), 0, 1, TimeUnit.MINUTES);
        System.out.println("User status update scheduler has been started.");
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        if (scheduler != null) {
            scheduler.shutdown();
            try {
                // Wait up to 1 minute for existing tasks to complete
                if (!scheduler.awaitTermination(1, TimeUnit.MINUTES)) {
                    scheduler.shutdownNow();
                }
            } catch (InterruptedException e) {
                scheduler.shutdownNow();
            }
        }
        System.out.println("User status update scheduler has been shut down.");
    }
} 