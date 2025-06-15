package com.webrtc.backend.servlet;

import java.io.IOException;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.webrtc.backend.dao.UserDao;
import com.webrtc.backend.model.User;

@WebServlet("/api/users/online")
public class OnlineUsersServlet extends HttpServlet {

    private final UserDao userDao = new UserDao();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            List<User> onlineUsers = userDao.getOnlineUsers();

            ArrayNode usersArray = objectMapper.createArrayNode();
            for (User user : onlineUsers) {
                ObjectNode userNode = objectMapper.createObjectNode();
                userNode.put("userId", user.getId());
                userNode.put("username", user.getUsername());
                usersArray.add(userNode);
            }

            resp.setContentType("application/json");
            resp.getWriter().write(objectMapper.writeValueAsString(usersArray));

        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 