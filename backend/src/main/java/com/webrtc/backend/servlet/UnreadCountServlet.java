package com.webrtc.backend.servlet;

import java.io.IOException;
import java.sql.SQLException;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.ChatDao;

@WebServlet("/api/chat/unread-count")
public class UnreadCountServlet extends HttpServlet {
    private final ChatDao chatDao = new ChatDao();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setHeader("Access-Control-Allow-Origin", "*");
        String userIdParam = req.getParameter("userId");
        if (userIdParam == null) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\": \"Missing userId parameter\"}");
            return;
        }

        try {
            int userId = Integer.parseInt(userIdParam);
            Map<Integer, Integer> unreadCounts = chatDao.getUnreadMessageCounts(userId);
            
            resp.setContentType("application/json");
            resp.getWriter().write(objectMapper.writeValueAsString(unreadCounts));

        } catch (NumberFormatException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\": \"Invalid userId parameter\"}");
        } catch (SQLException e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"error\": \"Database error fetching unread counts\"}");
            e.printStackTrace();
        }
    }
} 