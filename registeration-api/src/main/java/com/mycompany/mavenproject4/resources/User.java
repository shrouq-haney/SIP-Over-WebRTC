package com.mycompany.mavenproject4.resources;

public class User {
    private String username;
    private String password;
    private String contact;
    private String email;
    public User(){
        
    }
    public User(String username, String password, String contact, String email){
        this.contact = contact;
        this.username =username;
        this.password = password;
        this.email = email;
    }
    // Getters and setters (required for JSON mapping)
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getContact() { return contact; }
    public void setContact(String contact) { this.contact = contact; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }
}