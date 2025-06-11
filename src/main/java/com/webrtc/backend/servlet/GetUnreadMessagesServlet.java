package com.webrtc.backend.servlet;

import java.io.IOException;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.ChatDao;
import com.webrtc.backend.model.ChatMessage;

@WebServlet("/api/chat/unread")
public class GetUnreadMessagesServlet extends HttpServlet {
    private ChatDao chatDao = new ChatDao();
    private ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            int userId = Integer.parseInt(req.getParameter("userId"));

            List<ChatMessage> messages = chatDao.getUnreadMessages(userId);

            resp.setContentType("application/json");
            objectMapper.writeValue(resp.getWriter(), messages);
        } catch (NumberFormatException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("Missing or invalid user ID parameter");
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 