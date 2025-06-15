package com.webrtc.backend.servlet;

import java.io.IOException;
import java.util.Map;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.SignalingDao;
import com.webrtc.backend.model.CallStatus;

@WebServlet("/api/signaling/reject-call")
public class RejectCallServlet extends HttpServlet {
    private final SignalingDao signalingDao = new SignalingDao();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doOptions(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        // Handle CORS preflight request
        resp.setHeader("Access-Control-Allow-Origin", "*");
        resp.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
        resp.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        resp.setStatus(HttpServletResponse.SC_OK);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setHeader("Access-Control-Allow-Origin", "*");
        
        try {
            Map<String, String> payload = objectMapper.readValue(req.getReader(), new TypeReference<Map<String, String>>() {});
            String fromIdStr = payload.get("from");
            String toIdStr = payload.get("to");

            if (fromIdStr == null || toIdStr == null) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("{\"error\": \"Missing 'from' or 'to' parameter\"}");
                return;
            }

            int rejectorId = Integer.parseInt(fromIdStr);
            int callerId = Integer.parseInt(toIdStr);

            // The original offer was from 'callerId' to 'rejectorId'
            signalingDao.updateSdpStatus(callerId, rejectorId, CallStatus.REJECTED);

            resp.setStatus(HttpServletResponse.SC_OK);
        } catch (NumberFormatException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("{\"error\": \"Invalid 'from' or 'to' parameter. They must be numbers.\"}");
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 