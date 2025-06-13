package com.webrtc.backend.servlet;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.UserDao;
import com.webrtc.backend.model.User;
import com.webrtc.backend.util.PasswordUtil;

@WebServlet("/api/auth/login")
public class LoginServlet extends HttpServlet {

    private final UserDao userDao = new UserDao();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doOptions(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        // Handle CORS preflight request
        resp.setHeader("Access-Control-Allow-Origin", "*");
        resp.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
        resp.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        resp.setStatus(HttpServletResponse.SC_OK);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        // Add CORS headers for the actual request
        resp.setHeader("Access-Control-Allow-Origin", "*");
        resp.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
        resp.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

        try {
            User credentials = objectMapper.readValue(req.getReader(), User.class);
            System.out.println("Login attempt for msisdn: " + credentials.getMsisdn());

            User user = userDao.getUserByMsisdn(credentials.getMsisdn());

            if (user != null) {
                System.out.println("User found: " + user.getUsername());
                boolean passwordMatches = PasswordUtil.checkPassword(credentials.getPassword(), user.getPasswordHash());
                System.out.println("Password check result: " + passwordMatches);

                if (passwordMatches) {
                Map<String, Object> result = new HashMap<>();
                result.put("userId", user.getId());
                
                resp.setContentType("application/json");
                resp.getWriter().write(objectMapper.writeValueAsString(result));
                    System.out.println("Login successful for user: " + user.getUsername());
                } else {
                    System.out.println("Login failed: Incorrect password for user " + user.getUsername());
                    resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    resp.setContentType("application/json");
                    resp.getWriter().write("{\"error\": \"Incorrect password\"}");
                }
            } else {
                System.out.println("Login failed: No user found with msisdn " + credentials.getMsisdn());
                resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                resp.setContentType("application/json");
                resp.getWriter().write("{\"error\": \"Phone number not found\"}");
            }
        } catch (Exception e) {
            System.out.println("An exception occurred during login: " + e.getMessage());
            e.printStackTrace();
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }
} 