import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // В реальном проекте здесь можно отправлять логи в систему мониторинга
    console.error("Ошибка, перехваченная ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', textAlign: 'center', color: '#c72c41' }}>
          <h2>Что-то пошло не так.</h2>
          <p>Произошла ошибка при загрузке компонента. Пожалуйста, попробуйте обновить страницу.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;