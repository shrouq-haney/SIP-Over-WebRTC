package com.mycompany.mavenproject4.resources;

import jakarta.ws.rs.*;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.sql.*;
import java.util.HashMap;
import java.util.Map;

@Path("user")
public class UserResource {
    private static final String DB_URL = "jdbc:mysql://localhost:3306/webrtc1";
    private static final String DB_USER = "root";
    private static final String DB_PASSWORD = "root";

   @POST
@Path("register")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public Response registerUser(User user) {
    String username = user.getUsername();
    String password = user.getPassword();
    String contact = user.getContact();
    String email = user.getEmail();
    //load the driver
    try {
        Class.forName("com.mysql.cj.jdbc.Driver");
    } catch (ClassNotFoundException e) {
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(Map.of("error", "Failed to load MySQL driver")).build();
    }
    //connect to the database
        try (Connection conn = DriverManager.getConnection(DB_URL,DB_USER, DB_PASSWORD)) {
            String sql = "INSERT INTO users (username, password, contact, email) VALUES (?, ?, ?, ?)";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, username);
                stmt.setString(2, password);
                stmt.setString(3, contact);
                stmt.setString(4, email);
                stmt.executeUpdate();
            }
        } catch (SQLIntegrityConstraintViolationException e) {
            return Response.status(Response.Status.CONFLICT).entity(Map.of("error", "Username or email already exists")).build();
        } catch (SQLException e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(Map.of("error", e.getMessage())).build();
        }
        return Response.ok(Map.of("message", "Registration successful")).build();
    }

   @POST
@Path("login")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public Response loginUser(User user) {
    String username = user.getUsername();
    String password = user.getPassword();
        try (Connection conn = DriverManager.getConnection(DB_URL, DB_USER, DB_PASSWORD)) {
            String sql = "SELECT * FROM users WHERE username = ? AND password = ?";
            try (PreparedStatement stmt = conn.prepareStatement(sql)) {
                stmt.setString(1, username);
                stmt.setString(2, password);
                try (ResultSet rs = stmt.executeQuery()) {
                    if (rs.next()) {
                        User ret = new User(rs.getString("username"), null, rs.getString("contact"), rs.getString("email"));
                        return Response.ok(ret).build();
                    } else {
                        return Response.status(Response.Status.UNAUTHORIZED).entity(Map.of("error", "Invalid credentials")).build();
                    }
                }
            }
        } catch (SQLException e) {
            return Response.status(Response.Status.INTERNAL_SERVER_ERROR).entity(Map.of("error", e.getMessage())).build();
        }
    }
} 