// 도넛 차트 컴포넌트 - Chart.js를 사용하여 도넛 차트 렌더링
import { useEffect, useRef } from 'react'
import {
  Chart as ChartJS,
  ArcElement,
  DoughnutController,
  PieController,
  Tooltip,
  Legend
} from 'chart.js'
import './DonutChart.css'

ChartJS.register(
  ArcElement,
  DoughnutController,
  PieController,
  Tooltip,
  Legend
)

interface DonutChartProps {
  data: {
    labels: string[]
    datasets: {
      data: number[]
      amounts?: number[]
      backgroundColor: string[]
    }[]
  }
}

function DonutChart({ data }: DonutChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    console.log('DonutChart 데이터:', data)
    
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d')
      if (ctx) {
        // 데이터가 없는 경우 빈 차트 표시
        if (!data.datasets[0].data || data.datasets[0].data.length === 0) {
          console.log('차트 데이터가 없습니다.')
          if (chartRef.current && !chartRef.current.destroyed) {
            try {
              chartRef.current.destroy()
              chartRef.current = null
            } catch (error) {
              console.error('차트 제거 오류:', error)
            }
          }
          return
        }

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
          type: 'pie',
          data: data,
          options: {
            responsive: true,
            maintainAspectRatio: true,
            animation: {
              duration: 300, // 애니메이션 시간 단축
              easing: 'easeInOutQuart'
            },
            plugins: {
              legend: {
                display: false
              },
              tooltip: {
                callbacks: {
                  label: function(context: any) {
                    const dataset = context.dataset
                    const index = context.dataIndex
                    const count = dataset.data[index]
                    const amount = dataset.amounts ? dataset.amounts[index] : null
                    
                    let label = context.label + ': ' + count.toLocaleString() + '건'
                    if (amount !== null) {
                      const amountInManwon = Math.floor(amount / 10000)
                      label += ' (' + amountInManwon.toLocaleString() + '만원)'
                    }
                    return label
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
                display: false
              }
            },
            elements: {
              arc: {
                borderWidth: 3
              }
            }
          },
          plugins: [{
            id: 'customDatalabels',
            afterDatasetsDraw(chart: any) {
              const ctx = chart.ctx
              chart.data.datasets.forEach((dataset: any, i: number) => {
                const meta = chart.getDatasetMeta(i)
                meta.data.forEach((element: any, index: number) => {
                  const data = dataset.data[index]
                  const amount = dataset.amounts ? dataset.amounts[index] : null
                  const label = chart.data.labels[index]
                  
                  // 전체 합계 계산
                  const total = dataset.data.reduce((a: number, b: number) => a + b, 0)
                  const percentage = total > 0 ? ((data / total) * 100).toFixed(1) : 0
                  
                  // 텍스트 위치 계산
                  const { x, y } = element.tooltipPosition()
                  
                  // 텍스트 스타일
                  ctx.fillStyle = '#fff'
                  ctx.font = 'bold 13px sans-serif'
                  ctx.textAlign = 'center'
                  ctx.textBaseline = 'middle'
                  
                  // 그림자 효과
                  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
                  ctx.shadowBlur = 4
                  ctx.shadowOffsetX = 1
                  ctx.shadowOffsetY = 1
                  
                  // 레이블과 값 표시
                  if (amount !== null) {
                    // 금액이 있는 경우 4줄 표시
                    // 만원 단위로 변환 (10000원 단위까지 표시)
                    const amountInManwon = Math.floor((amount || 0) / 10000)
                    ctx.fillText(label, x, y - 20)
                    ctx.fillText(data + '건', x, y - 4)
                    ctx.fillText(percentage + '%', x, y + 12)
                    ctx.font = 'bold 12px sans-serif'
                    ctx.fillText(amountInManwon.toLocaleString() + '만', x, y + 28)
                  } else {
                    // 금액이 없는 경우 기존 3줄 표시
                    ctx.fillText(label, x, y - 12)
                    ctx.fillText(data + '건', x, y + 4)
                    ctx.fillText(percentage + '%', x, y + 20)
                  }
                  
                  // 그림자 초기화
                  ctx.shadowColor = 'transparent'
                  ctx.shadowBlur = 0
                  ctx.shadowOffsetX = 0
                  ctx.shadowOffsetY = 0
                })
              })
            }
          }]
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
  }, [data])

  return (
    <div className="donut-chart-wrapper">
      <canvas ref={canvasRef}></canvas>
    </div>
  )
}

export default DonutChart
