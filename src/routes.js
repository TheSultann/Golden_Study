import Dashboard from "./components/Dashboard/DashboardLayout.jsx"

import LoginPage from "./pages/LoginPage.jsx";
import RegisterPage from "./pages/RegisterPage.jsx";

const routes = [
    {
        id:1,
        path: '/',
        component: Dashboard,
    },
    {
        id:2,
        path: '/login',
        component: LoginPage,
    },
    {
        id:3,
        path: '/register',
        component: RegisterPage,
    }

]
export default routes;
