import React, { useState, useEffect } from 'react';
import { Activity, Clock, Database, TrendingUp, Zap, AlertCircle, CheckCircle, XCircle } from 'lucide-react';

const QuickShipDashboard = () => {
    // --- State Management ---
    const [metrics, setMetrics] = useState({
        totalRequests: 0,
        avgLatency: 0,
        cacheHitRate: 0,
        activeRequests: 0
    });
    
    // const [recentRequests, setRecentRequests] = useState([]);
    
    const [isSimulating, setIsSimulating] = useState(false);
    const [concurrentView, setConcurrentView] = useState(null);
    
    // Configuration for the visualizer to match Go services
    const serviceConfig = [
        { name: 'Price Service', duration: 200, key: 'price', color: 'bg-blue-500' },
        { name: 'Inventory Service', duration: 400, key: 'stock', color: 'bg-green-500' }, // Key maps to 'stock' in Go response
        { name: 'Promotion Service', duration: 50, key: 'promotion', color: 'bg-purple-500' }
    ];

    // --- API and Simulation Logic ---

    // Function to map Go's status to a friendly display string
    const mapStatus = (status) => {
        if (!status) return 'error';
        const s = status.toLowerCase();
        if (s === 'success') return 'success';
        if (s === 'timeout' || s === 'error') return 'failed';
        if (s === 'fallback') return 'fallback';
        return 'error';
    }

    // Simulate a request and fetch data from the Go API
    const simulateRequest = async () => {
        if (isSimulating) return;
        setIsSimulating(true);
        setConcurrentView(null);

        const startTime = Date.now();
        const traceId = `trace-${startTime}`;
        
        // Randomly select a SKU to test success or force a scenario (e.g., timeout)
        const skuToTest = Math.random() < 0.2 ? 'PRODUCT-TIMEOUT-401' : 'PRODUCT-SUCCESS-123';
        const API_BASE_URL = 'https://go-quickship.onrender.com'; 

        const apiUrl = `${API_BASE_URL}/cart/summary/${skuToTest}`;
        let summary = {};
        let latency = 0;

        try {
            // 1. Fetch data from the Go backend
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            summary = await response.json();
            latency = summary.total_time_ms;
        } catch (error) {
            console.error("API call failed (Go server down?):", error);
            // Fallback for a complete API failure
            latency = Date.now() - startTime;
            summary.total_time_ms = latency;
            summary.price_status = 'ERROR';
            summary.stock_status = 'ERROR';
            summary.promotion_status = 'ERROR';
            summary.service_errors = [{ service_key: 'API', message: 'Connection Error' }];
        }

        // 2. Initialize the visual animation structure
        setConcurrentView({
            traceId,
            services: serviceConfig.map(s => ({
                ...s,
                progress: 0,
                status: 'running',
                // Map the final status from the Go response
                finalStatus: mapStatus(summary[`${s.key}_status`])
            })),
            totalProgress: 0,
            finalLatency: latency
        });

        // 3. Animate the concurrent execution over the *actual* latency time
        const steps = 40; // More steps for smoother animation
        const interval = latency / steps; 
        let currentStep = 0;

        const timer = setInterval(() => {
            currentStep++;
            const totalProgress = Math.min(100, (currentStep / steps) * 100);
            
            setConcurrentView(prev => {
                if (!prev) return null;
                
                const updatedServices = prev.services.map(s => {
                    // Progress calculated based on its duration relative to the total Go latency
                    const timeElapsed = currentStep * interval;
                    // Progress is 100% after the service's mock duration has passed
                    const progress = Math.min(100, (timeElapsed / s.duration) * 100); 

                    return { 
                        ...s, 
                        progress, 
                        status: progress >= 100 ? 'complete' : 'running' 
                    };
                });

                return {
                    ...prev,
                    services: updatedServices,
                    totalProgress: totalProgress 
                };
            });
            
            if (currentStep >= steps) {
                clearInterval(timer);
                setIsSimulating(false);
            }
        }, interval);

        // 4. Update Metrics and Recent Requests
        // setRecentRequests(prev => [{
            // id: traceId,
            // sku: skuToTest,
            // latency,
            // fromCache: false, 
            // timestamp: new Date().toLocaleTimeString(),
            // services: {
            //     price: mapStatus(summary.price_status),
            //     inventory: mapStatus(summary.stock_status),
            //     promotion: mapStatus(summary.promotion_status),
            // }
        // }, ...prev.slice(0, 9)]);

        setMetrics(prev => ({
            totalRequests: prev.totalRequests + 1,
            avgLatency: ((prev.avgLatency * prev.totalRequests) + latency) / (prev.totalRequests + 1),
            cacheHitRate: prev.cacheHitRate, 
            activeRequests: 0
        }));

        // Clear concurrent view after 2 seconds
        setTimeout(() => setConcurrentView(null), 2000 + latency);
    };
    
    // Auto-simulate requests
    useEffect(() => {
        const intervalId = setInterval(() => {
            if (!isSimulating && Math.random() > 0.6) {
                simulateRequest();
            }
        }, 4000); // Wait longer between auto-simulations

        return () => clearInterval(intervalId);
    }, [isSimulating]);
    
    // --- Rendering Helpers ---

    const getStatusIcon = (status) => {
        switch(status) {
            case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'failed': return <XCircle className="w-4 h-4 text-red-500" />;
            case 'fallback': return <AlertCircle className="w-4 h-4 text-orange-500" />;
            default: return <AlertCircle className="w-4 h-4 text-yellow-500" />;
        }
    };
    
    // --- Component JSX ---
    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
            <div className="max-w-7xl mx-auto">
                
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <Zap className="w-8 h-8 text-yellow-400" />
                        <h1 className="text-4xl font-bold text-white">QuickShip Dashboard</h1>
                    </div>
                    <p className="text-slate-400">Real-time concurrent microservice aggregation monitoring</p>
                </div>
                
                {/* Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <Activity className="w-5 h-5 text-blue-400" />
                            <span className="text-2xl font-bold text-white">{metrics.totalRequests}</span>
                        </div>
                        <p className="text-slate-400 text-sm">Total Requests</p>
                    </div>
                    
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <Clock className="w-5 h-5 text-green-400" />
                            <span className="text-2xl font-bold text-white">{Math.round(metrics.avgLatency)}ms</span>
                        </div>
                        <p className="text-slate-400 text-sm">Avg Latency</p>
                    </div>
                    
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <Database className="w-5 h-5 text-purple-400" />
                            <span className="text-2xl font-bold text-white">{Math.round(metrics.cacheHitRate)}%</span>
                        </div>
                        <p className="text-slate-400 text-sm">Cache Hit Rate</p>
                    </div>
                    
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                        <div className="flex items-center justify-between mb-2">
                            <TrendingUp className="w-5 h-5 text-yellow-400" />
                            <span className="text-2xl font-bold text-white">{metrics.activeRequests}</span>
                        </div>
                        <p className="text-slate-400 text-sm">Active Requests</p>
                    </div>
                </div>
                
                {/* Concurrent Execution Visualizer */}
                {concurrentView && (
                    <div className="bg-slate-800 rounded-lg p-6 border border-slate-700 mb-6">
                        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Activity className="w-5 h-5 text-yellow-400 animate-pulse" />
                            Live Request Execution (Go Latency: {concurrentView.finalLatency}ms)
                        </h2>
                        
                        <div className="space-y-4">
                            {concurrentView.services.map((service, idx) => (
                                <div key={idx} className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-slate-300 font-medium">{service.name}</span>
                                        {/* Show service status after completion */}
                                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                                            service.finalStatus === 'success' ? 'bg-green-500/20 text-green-400' :
                                            service.finalStatus === 'failed' ? 'bg-red-500/20 text-red-400' :
                                            'bg-orange-500/20 text-orange-400'
                                        }`}>
                                            {service.finalStatus.toUpperCase()}
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-700 rounded-full h-3 overflow-hidden">
                                        <div 
                                            className={`${service.color} h-full transition-all duration-100 rounded-full`}
                                            style={{ width: `${service.progress}%` }}
                                        />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {service.progress < 100 ? (
                                            <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            getStatusIcon(service.finalStatus)
                                        )}
                                        <span className="text-xs text-slate-400">
                                            {service.progress < 100 ? `Running (${service.duration}ms mock time)` : 'Completed'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                            
                            <div className="mt-6 pt-4 border-t border-slate-700">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-white font-semibold">Total Request Progress</span>
                                    <span className="text-slate-400">{Math.round(concurrentView.totalProgress)}%</span>
                                </div>
                                <div className="w-full bg-slate-700 rounded-full h-4 overflow-hidden">
                                    <div 
                                        className="bg-gradient-to-r from-yellow-400 to-orange-500 h-full transition-all duration-200"
                                        style={{ width: `${concurrentView.totalProgress}%` }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                
                {/* Recent Requests */}
                {/* <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-white">Recent Requests</h2>
                        <button
                            onClick={simulateRequest}
                            disabled={isSimulating}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            {isSimulating ? 'Processing...' : 'Simulate Request'}
                        </button>
                    </div>
                    
                    <div className="space-y-2">
                        {recentRequests.length === 0 ? (
                            <p className="text-slate-400 text-center py-8">No requests yet. Click "Simulate Request" to start.</p>
                        ) : (
                            recentRequests.map((req, idx) => (
                                <div key={idx} className="bg-slate-700 rounded-lg p-4 flex items-center justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-white font-mono text-sm">{req.sku}</span>
                                            {req.fromCache && (
                                                <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded text-xs font-semibold">
                                                    CACHED
                                                </span>
                                            )}
                                            <span className="text-slate-400 text-xs">{req.timestamp}</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {Object.entries(req.services).map(([service, status]) => (
                                                <div key={service} className="flex items-center gap-1">
                                                    {getStatusIcon(status)}
                                                    <span className={`text-xs capitalize ${status === 'fallback' ? 'text-orange-400' : 'text-slate-400'}`}>{service}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-white font-semibold">{req.latency}ms</div>
                                        <div className="text-slate-400 text-xs">Latency</div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div> */}
                
                {/* Performance Comparison */}
                <div className="mt-6 bg-slate-800 rounded-lg p-6 border border-slate-700">
                    <h2 className="text-xl font-bold text-white mb-4">Sequential vs Concurrent Performance</h2>
                    {/* The static comparison blocks remain for illustrative purposes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Sequential Block */}
                        <div className="space-y-3">
                            <h3 className="text-slate-300 font-semibold">Sequential Execution</h3>
                            <div className="bg-slate-700 rounded-lg p-4">
                                <div className="text-3xl font-bold text-red-400 mb-2">650ms</div>
                                <div className="text-slate-400 text-sm mb-3">200ms + 400ms + 50ms</div>
                                <div className="space-y-2">
                                    {serviceConfig.map((s, i) => (
                                        <div className="flex items-center gap-2" key={i}>
                                            <div className="w-full bg-slate-600 rounded h-2">
                                                <div className={`${s.color} h-2 rounded`} style={{width: `${s.duration / 6.5}%`}} />
                                            </div>
                                            <span className="text-xs text-slate-400 w-16">{s.duration}ms</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                        
                        {/* Concurrent Block */}
                        <div className="space-y-3">
                            <h3 className="text-slate-300 font-semibold">Concurrent Execution (Fan-Out/Fan-In)</h3>
                            <div className="bg-slate-700 rounded-lg p-4">
                                <div className="text-3xl font-bold text-green-400 mb-2">~400ms</div>
                                <div className="text-slate-400 text-sm mb-3">Max(200ms, 400ms, 50ms)</div>
                                <div className="space-y-2">
                                    {serviceConfig.map((s, i) => (
                                        <div className="flex items-center gap-2" key={i}>
                                            <div className="w-full bg-slate-600 rounded h-2">
                                                {/* All services complete within the max duration (400ms) */}
                                                <div className={`${s.color} h-2 rounded`} style={{width: `${s.duration / 4}%`}} />
                                            </div>
                                            <span className="text-xs text-slate-400 w-16">{s.duration}ms</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4 pt-3 border-t border-slate-600">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-green-400 font-semibold">38.5% Faster</span>
                                        <span className="text-slate-400">250ms saved</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default QuickShipDashboard;