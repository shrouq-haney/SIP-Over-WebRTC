package com.webrtc.backend.servlet;

import java.io.IOException;
import java.util.List;

import javax.servlet.ServletException;
import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.webrtc.backend.dao.SignalingDao;
import com.webrtc.backend.model.IceCandidate;

@WebServlet("/api/signaling/get-candidates")
public class GetCandidatesServlet extends HttpServlet {
    private SignalingDao signalingDao = new SignalingDao();
    private ObjectMapper objectMapper = new ObjectMapper();

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        try {
            int receiverId = Integer.parseInt(req.getParameter("receiverId"));
            List<IceCandidate> candidates = signalingDao.getIceCandidates(receiverId);
            resp.setContentType("application/json");
            objectMapper.writeValue(resp.getWriter(), candidates);
        } catch (NumberFormatException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("Missing or invalid receiverId parameter");
        } catch (Exception e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            e.printStackTrace();
        }
    }
} 