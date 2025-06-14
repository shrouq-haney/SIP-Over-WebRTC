package com.webrtc.backend.service;

import java.sql.SQLException;

import com.webrtc.backend.dao.UserDao;

public class UserStatusUpdaterTask implements Runnable {

    private final UserDao userDao = new UserDao();
    private static final int TIMEOUT_MINUTES = 2;

    @Override
    public void run() {
        try {
            System.out.println("Running background task: Updating user statuses...");
            userDao.updateOfflineUsers(TIMEOUT_MINUTES);
            System.out.println("User status update task finished.");
        } catch (SQLException e) {
            // In a real application, you would use a robust logging framework like SLF4J or Log4j
            System.err.println("Error running user status update task: " + e.getMessage());
            e.printStackTrace();
        } catch (Exception e) {
            System.err.println("An unexpected error occurred in the user status update task: " + e.getMessage());
            e.printStackTrace();
        }
    }
} 