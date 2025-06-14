package com.webrtc.backend.servlet;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.UserDao;
import com.webrtc.backend.model.User;
import com.webrtc.backend.util.PasswordUtil;

@WebServlet("/api/auth/register")
public class RegisterServlet extends HttpServlet {

    private final UserDao userDao = new UserDao();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            User user = objectMapper.readValue(req.getReader(), User.class);

            // Check if user with the same msisdn already exists
            if (userDao.getUserByMsisdn(user.getMsisdn()) != null) {
                resp.setStatus(HttpServletResponse.SC_CONFLICT); // 409 Conflict
                resp.getWriter().write("A user with this phone number already exists.");
                return;
            }

            // Check if user with the same username already exists
            if (userDao.getUserByUsername(user.getUsername()) != null) {
                resp.setStatus(HttpServletResponse.SC_CONFLICT); // 409 Conflict
                resp.getWriter().write("A user with this username already exists.");
                return;
            }

            // The JSON should now contain 'username', 'password', and 'msisdn'
            user.setPasswordHash(PasswordUtil.hashPassword(user.getPassword()));
            userDao.createUser(user);
            resp.setStatus(HttpServletResponse.SC_CREATED);
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 