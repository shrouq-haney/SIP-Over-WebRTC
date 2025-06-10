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
import com.webrtc.backend.dao.SignalingDao;
import com.webrtc.backend.model.SdpExchange;

@WebServlet("/api/signaling/call-status")
public class CallStatusServlet extends HttpServlet {
    private SignalingDao signalingDao = new SignalingDao();
    private ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            int senderId = Integer.parseInt(req.getParameter("from"));
            int receiverId = Integer.parseInt(req.getParameter("to"));

            SdpExchange sdp = signalingDao.getCallStatus(senderId, receiverId);

            if (sdp != null) {
                Map<String, Object> responsePayload = new HashMap<>();
                responsePayload.put("status", sdp.getStatus());
                responsePayload.put("by", sdp.getReceiverId()); // The user who last acted on the call

                resp.setContentType("application/json");
                objectMapper.writeValue(resp.getWriter(), responsePayload);
            } else {
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            }
        } catch (NumberFormatException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("Missing or invalid 'from' or 'to' parameter");
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 