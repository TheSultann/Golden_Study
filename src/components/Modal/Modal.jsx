import React from 'react';
import ReactModal from 'react-modal';
import styles from './Modal.module.css';
import { FiX } from 'react-icons/fi';

ReactModal.setAppElement('#root');

// Добавлен `modalClassName` в пропсы
const Modal = ({ isOpen, onRequestClose, title, children, modalClassName = '' }) => {
    return (
        <ReactModal
            isOpen={isOpen}
            onRequestClose={onRequestClose}
            // Класс теперь динамический: базовый + дополнительный
            className={`${styles.modal} ${modalClassName}`}
            overlayClassName={styles.overlay}
            contentLabel={title}
        >
            <div className={styles.header}>
                <h3 className={styles.title}>{title}</h3>
                <button onClick={onRequestClose} className={styles.closeButton}>
                    <FiX size={24} />
                </button>
            </div>
            <div className={styles.content}>
                {children}
            </div>
        </ReactModal>
    );
};

export default Modal;