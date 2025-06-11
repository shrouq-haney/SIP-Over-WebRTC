package com.webrtc.backend.servlet;

import java.io.IOException;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.SignalingDao;
import com.webrtc.backend.model.IceCandidate;

@WebServlet("/api/signaling/send-candidate")
public class SendCandidateServlet extends HttpServlet {
    private SignalingDao signalingDao = new SignalingDao();
    private ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            IceCandidate candidate = objectMapper.readValue(req.getReader(), IceCandidate.class);
            signalingDao.saveIceCandidate(candidate);
            resp.setStatus(HttpServletResponse.SC_OK);
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 