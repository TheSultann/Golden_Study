import React from 'react';
import { NavLink, useHistory } from 'react-router-dom';
import styles from './Sidebar.module.css';
import { FiGrid, FiUsers, FiSettings, FiLogOut } from 'react-icons/fi';
import { BsFillEmojiSunglassesFill } from 'react-icons/bs';

const Sidebar = () => {
    const history = useHistory();
    const role = localStorage.getItem('userRole');

    const handleLogout = () => {
        localStorage.removeItem('userToken');
        localStorage.removeItem('userRole');
        localStorage.removeItem('userName');
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
                    <NavLink to="/" exact className={styles.menuItem} activeClassName={styles.active}>
                        <FiGrid size={24} />
                    </NavLink>
                </li>
                
                {role === 'teacher' && (
                    <li>
                        <NavLink to="/groups" className={styles.menuItem} activeClassName={styles.active}>
                            <FiUsers size={24} />
                        </NavLink>
                    </li>
                )}
                {/* ИЗМЕНЕНИЕ: ДОБАВЛЕНА ССЫЛКА НА НАСТРОЙКИ ДЛЯ МОБИЛЬНОЙ ВЕРСИИ */}
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
            </ul>

            <ul className={styles.bottomMenu}>
                {/* ИЗМЕНЕНИЕ: ИКОНКА НАСТРОЕК СТАЛА ССЫЛКОЙ */}
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