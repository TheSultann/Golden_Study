// src/components/ActivityChart/ActivityChart.jsx
import React from 'react';
import { ResponsiveContainer, AreaChart, Area, Tooltip, XAxis } from 'recharts';
import styles from './ActivityChart.module.css';

// Тултип теперь показывает просто значение и слово "Score"
const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
        return (
            <div className={styles.customTooltip}>
                <p className={styles.tooltipLabel}>{`${payload[0].value}% Score`}</p>
            </div>
        );
    }
    return null;
};

// Компонент теперь принимает `data` как пропс
const ActivityChart = ({ data }) => {
    return (
        <div className={styles.chartContainer}>
            <ResponsiveContainer width="100%" height={120}>
                <AreaChart
                    data={data} // Используем переданные данные
                    margin={{ top: 10, right: 0, left: 0, bottom: 0 }}
                >
                    <defs>
                        {/* Градиент для заливки можно оставить тот же */}
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8884d8" stopOpacity={0.1}/>
                            <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <Tooltip
                        content={<CustomTooltip />}
                        cursor={{ stroke: 'lightgrey', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <XAxis dataKey="week" stroke="#ccc" fontSize={12} tickLine={false} axisLine={false} />
                    <Area
                        type="monotone"
                        dataKey="score" // Теперь график строится по ключу "score"
                        stroke="#8884d8"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorScore)"
                        dot={false}
                        activeDot={{ r: 6, stroke: 'white', strokeWidth: 2, fill: '#8884d8' }}
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
};

export default ActivityChart;
