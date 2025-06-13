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
    private SignalingDao signalingDao = new SignalingDao();
    private ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        resp.setHeader("Access-Control-Allow-Origin", "*");
        try {
            String userIdStr = req.getParameter("userId");
            if (userIdStr == null) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("Missing userId parameter");
                return;
            }
            int receiverId = Integer.parseInt(userIdStr);
            SdpExchange sdp = signalingDao.getSdp(receiverId);
            if (sdp != null) {
                resp.setContentType("application/json");
                objectMapper.writeValue(resp.getWriter(), sdp);
            } else {
                resp.setStatus(HttpServletResponse.SC_NOT_FOUND);
            }
        } catch (NumberFormatException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("Missing or invalid userId parameter");
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 