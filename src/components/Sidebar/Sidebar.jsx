import React from 'react';
import { NavLink, useHistory } from 'react-router-dom';
import styles from './Sidebar.module.css';
// --- ИЗМЕНЕНО: Добавлена иконка FiBookOpen для панели учителя ---
import { FiGrid, FiUsers, FiSettings, FiLogOut, FiDollarSign, FiBriefcase, FiBookOpen } from 'react-icons/fi';
import { BsFillEmojiSunglassesFill } from 'react-icons/bs';

const Sidebar = () => {
    const history = useHistory();
    const role = localStorage.getItem('userRole');

    const handleLogout = () => {
        localStorage.clear();
        history.push('/login');
        window.location.reload();
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

                {/* Этот блок содержит ссылки ТОЛЬКО для администратора */}
                {role === 'admin' && (
                    <>
                        {/* --- НОВЫЙ БЛОК: Ссылка на личную панель учителя для админа --- */}
                        <li>
                            <NavLink to="/my-dashboard" className={styles.menuItem} activeClassName={styles.active} title="My Teacher Panel">
                                <FiBookOpen size={24} />
                            </NavLink>
                        </li>
                        {/* --- КОНЕЦ НОВОГО БЛОКА --- */}
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

                <li style={{display: 'none'}} className={styles.settingsIconMobile}>
                    <NavLink to="/settings" className={styles.menuItem} activeClassName={styles.active} title="Settings">
                        <FiSettings size={24} />
                    </NavLink>
                </li>
                 <li style={{display: 'none'}} className={styles.logoutIconMobile}>
                    <div className={styles.menuItem} onClick={handleLogout} title="Logout">
                        <FiLogOut size={24} />
                    </div>
                </li>

                {(role === 'teacher' || role === 'admin') && (
                    <li>
                        <NavLink to="/groups" className={styles.menuItem} activeClassName={styles.active} title="Groups">
                            <FiUsers size={24} />
                        </NavLink>
                    </li>
                )}  
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