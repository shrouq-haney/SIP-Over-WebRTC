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
    private SignalingDao signalingDao = new SignalingDao();
    private ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            Map<String, String> payload = objectMapper.readValue(req.getReader(), new TypeReference<Map<String, String>>() {});
            int rejectorId = Integer.parseInt(payload.get("from"));
            int callerId = Integer.parseInt(payload.get("to"));

            // The original offer was from 'callerId' to 'rejectorId'
            signalingDao.updateSdpStatus(callerId, rejectorId, CallStatus.REJECTED);

            resp.setStatus(HttpServletResponse.SC_OK);
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 