package com.webrtc.backend.servlet;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.ChatDao;
import com.webrtc.backend.model.ChatMessage;

@WebServlet("/api/chat/*")
public class ChatServlet extends HttpServlet {

    private final ChatDao chatDao = new ChatDao();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        String pathInfo = req.getPathInfo();

        try {
            if (pathInfo == null || pathInfo.equals("/")) {
                resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid endpoint");
                return;
            }

            if (pathInfo.equals("/messages")) {
                handleGetMessages(req, resp);
            } else if (pathInfo.equals("/unread")) {
                handleGetUnreadMessages(req, resp);
            } else {
                resp.sendError(HttpServletResponse.SC_NOT_FOUND, "Endpoint not found");
            }
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }

    private void handleGetMessages(HttpServletRequest req, HttpServletResponse resp) throws IOException, SQLException {
        String userId1Param = req.getParameter("userId1");
        String userId2Param = req.getParameter("userId2");

        if (userId1Param == null || userId2Param == null) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "Both userId1 and userId2 parameters are required");
            return;
        }

        try {
            int userId1 = Integer.parseInt(userId1Param);
            int userId2 = Integer.parseInt(userId2Param);

            List<ChatMessage> messages = chatDao.getMessages(userId1, userId2);
            
            // Mark messages from userId2 to userId1 as read
            chatDao.markAllAsRead(userId2, userId1);

            resp.setContentType("application/json");
            resp.getWriter().write(objectMapper.writeValueAsString(messages));
        } catch (NumberFormatException e) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid user ID format");
        }
    }

    private void handleGetUnreadMessages(HttpServletRequest req, HttpServletResponse resp) throws IOException, SQLException {
        String userIdParam = req.getParameter("userId");

        if (userIdParam == null) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "userId parameter is required");
            return;
        }

        try {
            int userId = Integer.parseInt(userIdParam);
            List<ChatMessage> messages = chatDao.getUnreadMessages(userId);

            resp.setContentType("application/json");
            resp.getWriter().write(objectMapper.writeValueAsString(messages));
        } catch (NumberFormatException e) {
            resp.sendError(HttpServletResponse.SC_BAD_REQUEST, "Invalid user ID format");
        }
    }
} 