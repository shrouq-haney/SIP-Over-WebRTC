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
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            User credentials = objectMapper.readValue(req.getReader(), User.class);
            User user = userDao.getUserByUsername(credentials.getUsername());

            if (user != null && PasswordUtil.checkPassword(credentials.getPassword(), user.getPasswordHash())) {
                Map<String, Object> result = new HashMap<>();
                result.put("userId", user.getId());
                
                resp.setContentType("application/json");
                resp.getWriter().write(objectMapper.writeValueAsString(result));
            } else {
                resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            }
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 