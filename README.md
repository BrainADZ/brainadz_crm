# CRM Admin Dashboard

## Overview

This project is a **Customer Relationship Management (CRM) system** built using the MERN (MongoDB, Express.js, React.js, Node.js) stack. It provides two distinct dashboards for **Admins** and **Employees** with various features tailored to their roles.

## Features

### Admin Dashboard

- **Client Management**: Admins can view, add, update, and delete clients.
- **Employee Management**: Admins can manage employee records.
- **Client Assignment**: Admins can assign clients to specific employees for follow-up.
- **Task Review**: Admins can review comments and statuses submitted by employees regarding client interactions.

### Employee Dashboard

- **Task Management**: Employees can view tasks assigned to them.
- **Client Interaction**: Employees can submit comments, statuses, and screenshots related to client interactions.
- **Task History**: Employees can view their previous comments and tasks to track their work history.

## File Structure

### Frontend

- **`src/components/`**: Contains reusable components such as Navbar, Sidebar, and PrivateRoute.
- **`src/pages/`**: Contains main pages for both Admin and Employee views, including login pages.
- **`src/assets/`**: Contains images and other assets used in the project.
- **`src/Style.css`**: Contains global styling for the application.

### Backend

- **`routes/`**: Contains the routes for authentication, clients, and employees.
- **`models/`**: Contains Mongoose models for User and Client.
- **`middleware/`**: Contains middleware for authentication.
- **`uploads/`**: Directory where uploaded images are stored.

## Installation

### Prerequisites

- Node.js
- MongoDB

### Setup Instructions

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/your-crm-repo.git
   cd your-crm-repo
   ```
2. Install dependencies for both the frontend and backend:

   ```bash
   # Install backend dependencies
     cd crm-backend
     npm install

   # Install frontend dependencies
     cd ../crm-admin-dashboard
     npm install

   ```

3. Create a .env file in the crm-backend directory and configure your environment variables:

   ```bash
   JWT_SECRET=your_jwt_secret
   MONGO_URI=your_mongodb_uri

   ```

4. Start the development servers:

   ```bash
   # Start backend server
   cd crm-backend
   npm start

   # Start frontend server
   cd ../crm-admin-dashboard
   npm start

   ```

5. Open your browser and navigate to http://localhost:3000 to access the application.

## Usage

Admin: Log in using admin credentials to access the admin dashboard, where you can manage clients, employees, and assignments.
Employee: Log in using employee credentials to access the employee dashboard, where you can manage your tasks and view client interaction history.

## Contributing

1. Fork the repository.
2. Create your feature branch (git checkout -b feature/AmazingFeature).
3. Commit your changes (git commit -m 'Add some AmazingFeature').
4. Push to the branch (git push origin feature/AmazingFeature).
5. Open a Pull Request.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
