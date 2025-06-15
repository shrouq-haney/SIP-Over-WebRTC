package com.webrtc.backend.servlet;

import java.io.IOException;
import java.util.stream.Collectors;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.SignalingDao;
import com.webrtc.backend.model.SdpExchange;

@WebServlet("/api/signaling/send-sdp")
public class SendSdpServlet extends HttpServlet {
    private SignalingDao signalingDao = new SignalingDao();
    private ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doOptions(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        // Handle CORS preflight request
        resp.setHeader("Access-Control-Allow-Origin", "*");
        resp.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE");
        resp.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
        resp.setStatus(HttpServletResponse.SC_OK);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        // Add CORS headers for the actual request
        resp.setHeader("Access-Control-Allow-Origin", "*");
        
        try {
            // Read and log the raw JSON payload from the request
            String jsonPayload = req.getReader().lines().collect(Collectors.joining(System.lineSeparator()));
            System.out.println("--- RECEIVED SDP PAYLOAD ---");
            System.out.println(jsonPayload);
            System.out.println("--------------------------");

            // Process the JSON from the string we just logged
            SdpExchange sdp = objectMapper.readValue(jsonPayload, SdpExchange.class);
            signalingDao.saveSdp(sdp);
            resp.setStatus(HttpServletResponse.SC_OK);
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 