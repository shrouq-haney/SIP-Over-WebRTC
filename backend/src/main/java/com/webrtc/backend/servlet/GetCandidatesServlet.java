package com.webrtc.backend.servlet;

import java.io.IOException;
import java.sql.SQLException;
import java.util.ArrayList;
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
        resp.setHeader("Access-Control-Allow-Origin", "*");
        try {
            String userIdStr = req.getParameter("userId");
            if (userIdStr == null) {
                resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
                resp.getWriter().write("Missing userId parameter");
                return;
            }
            int receiverId = Integer.parseInt(userIdStr);
            List<IceCandidate> candidates = signalingDao.getIceCandidates(receiverId);

            if (candidates != null && !candidates.isEmpty()) {
                resp.setContentType("application/json");
                objectMapper.writeValue(resp.getWriter(), candidates);
                // After sending the candidates, delete them to avoid resending
                signalingDao.deleteIceCandidates(receiverId);
            } else {
                // If no candidates, send back an empty array
                resp.setContentType("application/json");
                objectMapper.writeValue(resp.getWriter(), new ArrayList<>());
            }
        } catch (NumberFormatException e) {
            resp.setStatus(HttpServletResponse.SC_BAD_REQUEST);
            resp.getWriter().write("Missing or invalid userId parameter");
        } catch (SQLException e) {
            resp.setStatus(HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
            resp.getWriter().write("{\"error\": \"Database error fetching candidates\"}");
            e.printStackTrace();
        }
    }
} 