import React, { useState } from "react";
import { NavLink } from "react-router-dom";
import { auth } from "../firebase/config";
import { useAuthState } from "react-firebase-hooks/auth";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  Link,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { signOut } from "firebase/auth";

const Navbar: React.FC = () => {
  const [user] = useAuthState(auth);
  const [userMenuAnchorEl, setUserMenuAnchorEl] = useState<null | HTMLElement>(
    null
  );
  const [mobileMenuAnchorEl, setMobileMenuAnchorEl] =
    useState<null | HTMLElement>(null);

  const isUserMenuOpen = Boolean(userMenuAnchorEl);
  const isMobileMenuOpen = Boolean(mobileMenuAnchorEl);

  const handleUserMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setUserMenuAnchorEl(event.currentTarget);
  };

  const handleUserMenuClose = () => {
    setUserMenuAnchorEl(null);
  };

  const handleMobileMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setMobileMenuAnchorEl(event.currentTarget);
  };

  const handleMobileMenuClose = () => {
    setMobileMenuAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
    handleUserMenuClose();
    handleMobileMenuClose();
  };

  const navLinks = [
    { title: "Daily Entry", path: "/" },
    { title: "Dashboard", path: "/dashboard" },
    { title: "Settings", path: "/settings" },
  ];

  return (
    <>
      {/* <div className="w-full h-10 "></div> */}
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Milk Expense
          </Typography>

          {/* Desktop Navigation */}
          <Box
            sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
          >
            {navLinks.map((link) => (
              <Link
                key={link.title}
                component={NavLink}
                to={link.path}
                color="inherit"
                underline="none"
                sx={{
                  mx: 2,
                  "&.active": {
                    fontWeight: "bold",
                    color: "primary.main",
                  },
                }}
              >
                {link.title}
              </Link>
            ))}
          </Box>

          {/* User Menu (Desktop) */}
          {user && (
            <Box
              sx={{ display: { xs: "none", md: "flex" }, alignItems: "center" }}
            >
              <IconButton
                onClick={handleUserMenuOpen}
                color="inherit"
                sx={{ ml: 2 }}
              >
                <Avatar
                  alt={user.displayName || "User"}
                  src={user.photoURL || undefined}
                  sx={{ width: 32, height: 32 }}
                />
              </IconButton>
              <Menu
                anchorEl={userMenuAnchorEl}
                open={isUserMenuOpen}
                onClose={handleUserMenuClose}
                anchorOrigin={{
                  vertical: "bottom",
                  horizontal: "right",
                }}
                transformOrigin={{
                  vertical: "top",
                  horizontal: "right",
                }}
                keepMounted
              >
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </Box>
          )}

          {/* Mobile Navigation */}
          <Box sx={{ display: { xs: "flex", md: "none" } }}>
            <IconButton
              edge="start"
              color="inherit"
              aria-label="menu"
              onClick={handleMobileMenuOpen}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={mobileMenuAnchorEl}
              open={isMobileMenuOpen}
              onClose={handleMobileMenuClose}
              sx={{ display: { xs: "block", md: "none" } }}
            >
              {navLinks.map((link) => (
                <MenuItem
                  key={link.title}
                  onClick={handleMobileMenuClose}
                  component={NavLink}
                  to={link.path}
                >
                  {link.title}
                </MenuItem>
              ))}
              {user && <MenuItem onClick={handleLogout}>Logout</MenuItem>}
            </Menu>
          </Box>
        </Toolbar>
      </AppBar>
    </>
  );
};

export default Navbar;
