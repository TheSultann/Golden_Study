import React from 'react';
import { NavLink, useHistory } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { FiGrid, FiUsers, FiSettings, FiLogOut, FiDollarSign, FiBriefcase, FiBookOpen } from 'react-icons/fi';
import { BsFillEmojiSunglassesFill } from 'react-icons/bs';

const Sidebar = () => {
    const history = useHistory();
    const role = localStorage.getItem('userRole');

    const handleLogout = () => {
        // Remove only app-specific keys instead of clearing all localStorage
        localStorage.removeItem('userToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
        // Use window.location.href for clean state reset
        window.location.href = '/login';
    };

    return (
        <nav className={styles.sidebar}>
            <div className={styles.logo}>
                <BsFillEmojiSunglassesFill size={28} />
            </div>
            
            <ul className={styles.menu}>
                <li>
                    <NavLink 
                        to={role === 'admin' ? "/overview" : "/"} 
                        exact 
                        className={styles.menuItem} 
                        activeClassName={styles.active}
                        title={role === 'admin' ? "Overview" : "Dashboard"}
                    >
                        <FiGrid size={24} />
                    </NavLink>
                </li>      

                {role === 'admin' && (
                    <>
                        <li>
                            <NavLink to="/my-dashboard" className={styles.menuItem} activeClassName={styles.active} title="My Teacher Panel">
                                <FiBookOpen size={24} />
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/finance" className={styles.menuItem} activeClassName={styles.active} title="Finance">
                                <FiDollarSign size={24} />
                            </NavLink>
                        </li>
                        <li>
                            <NavLink to="/accounting" className={styles.menuItem} activeClassName={styles.active} title="Accounting">
                                <FiBriefcase size={24} />
                            </NavLink>
                        </li>
                    </>
                )}

                {(role === 'teacher' || role === 'admin') && (
                    <li>
                        <NavLink to="/groups" className={styles.menuItem} activeClassName={styles.active} title="Groups">
                            <FiUsers size={24} />
                        </NavLink>
                    </li>
                )}

                {role === 'student' && (
                    <li>
                        <NavLink to="/my-payments" className={styles.menuItem} activeClassName={styles.active} title="My Payments">
                            <FiDollarSign size={24} />
                        </NavLink>
                    </li>
                )}

                {/* --- CHANGE: Mobile icons moved to end of list and arranged in correct order --- */}
                
                {/* First Settings */}
                <li style={{display: 'none'}} className={styles.settingsIconMobile}>
                    <NavLink to="/settings" className={styles.menuItem} activeClassName={styles.active} title="Settings">
                        <FiSettings size={24} />
                    </NavLink>
                </li>

                {/* Then Logout (last element) */}
                 <li style={{display: 'none'}} className={styles.logoutIconMobile}>
                    <div className={styles.menuItem} onClick={handleLogout} title="Logout">
                        <FiLogOut size={24} />
                    </div>
                </li>

                {/* --- END OF CHANGES --- */}
            </ul>

            <ul className={styles.bottomMenu}>
                <li>
                    <NavLink to="/settings" className={styles.menuItem} activeClassName={styles.active} title="Settings">
                        <FiSettings size={24} />
                    </NavLink>
                </li>
                <li>
                    <div className={styles.menuItem} onClick={handleLogout} title="Logout">
                        <FiLogOut size={24} />
                    </div>
                </li>
            </ul>
        </nav>
    );
};

export default Sidebar;