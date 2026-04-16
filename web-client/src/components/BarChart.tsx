// 막대 차트 컴포넌트 - Chart.js를 사용하여 누적 막대 차트 렌더링
import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend
} from 'chart.js'
import ChartDataLabels from 'chartjs-plugin-datalabels'
import './BarChart.css'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  BarController,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
)

interface BarChartProps {
  data: {
    labels: string[]
    datasets: {
      label: string
      data: number[]
      backgroundColor: string
    }[]
  }
  type?: 'count' | 'amount' // 주문 건수 또는 금액
}

function BarChart({ data, type = 'count' }: BarChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        // 기존 차트가 있고 유효한 경우 데이터만 업데이트
        if (chartRef.current && !chartRef.current.destroyed) {
          try {
            chartRef.current.data = data
            chartRef.current.update('none') // 애니메이션 없이 즉시 업데이트
            return
          } catch (error) {
            console.error('차트 업데이트 오류:', error)
            // 오류 발생 시 차트 재생성
            if (chartRef.current) {
              chartRef.current.destroy()
              chartRef.current = null
            }
          }
        }

        // 새 차트 생성
        chartRef.current = new ChartJS(ctx, {
          type: 'bar',
          data: data,
          options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
              duration: 300, // 애니메이션 시간 단축
              easing: 'easeInOutQuart'
            },
            scales: {
              x: {
                grid: {
                  display: false
                }
              },
              y: {
                beginAtZero: true,
                ticks: {
                  callback: function(value: any) {
                    if (type === 'amount') {
                      // 금액인 경우 만원 단위로 표시
                      return Math.floor(value / 10000).toLocaleString() + '만'
                    }
                    return value.toLocaleString()
                  }
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.05)'
                }
              }
            },
            plugins: {
              legend: {
                position: 'bottom' as const,
                labels: {
                  padding: 15,
                  font: {
                    size: 12,
                    weight: 'bold' as const
                  },
                  usePointStyle: true,
                  pointStyle: 'circle'
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context: any) {
                    if (type === 'amount') {
                      // 금액인 경우 만원 단위로 표시
                      const amountInManwon = Math.floor(context.parsed.y / 10000)
                      return context.dataset.label + ': ' + amountInManwon.toLocaleString() + '만원'
                    }
                    return context.dataset.label + ': ' + context.parsed.y.toLocaleString() + '건'
                  }
                },
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 12,
                cornerRadius: 6,
                titleFont: {
                  size: 14,
                  weight: 'bold'
                },
                bodyFont: {
                  size: 13
                }
              },
              datalabels: {
                display: true,
                color: '#333',
                anchor: 'end',
                align: 'top',
                offset: -4,
                font: {
                  size: 11,
                  weight: 'bold'
                },
                formatter: function(value: any) {
                  if (value === 0) return ''
                  if (type === 'amount') {
                    const amountInManwon = Math.floor(value / 10000)
                    return amountInManwon.toLocaleString() + '만'
                  }
                  return value.toLocaleString()
                }
              }
            }
          }
        })
      }
    }

    // 컴포넌트 언마운트 시 차트 제거
    return () => {
      if (chartRef.current && !chartRef.current.destroyed) {
        try {
          chartRef.current.destroy()
          chartRef.current = null
        } catch (error) {
          console.error('차트 제거 오류:', error)
        }
      }
    }
  }, [data, type])

  return (
    <div className="bar-chart-wrapper">
      <canvas ref={canvasRef}></canvas>
    </div>
  )
}

export default BarChart
