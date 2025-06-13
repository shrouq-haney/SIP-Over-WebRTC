package com.webrtc.backend.servlet;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.SignalingDao;
import com.webrtc.backend.model.SdpExchange;

@WebServlet("/api/signaling/get-sdp")
public class GetSdpServlet extends HttpServlet {
    private final SignalingDao signalingDao = new SignalingDao();
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
            
            // Use the new method that consumes the SDP
            SdpExchange sdp = signalingDao.consumeSdpForUser(userId);

            if (sdp != null) {
                // Found a new call notification, send it to the frontend
                resp.setContentType("application/json");
                resp.getWriter().write(objectMapper.writeValueAsString(sdp));
            } else {
                // This is the normal, successful case when there are no new calls
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            }
        } catch (NumberFormatException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\": \"Invalid userId parameter\"}");
        }
    }
} 