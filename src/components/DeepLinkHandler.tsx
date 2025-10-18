"use client";

import React, { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DeepLinkHandler: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleDeepLink = () => {
      const path = location.pathname;
      const search = location.search;

      // Example internal deep links
      if (path.startsWith('/tasks') && search.includes('action=new')) {
        navigate('/tasks', { state: { openNewTaskForm: true }, replace: true });
      } else if (path.startsWith('/clients') && search.includes('openTaskId=')) {
        const taskId = new URLSearchParams(search).get('openTaskId');
        const clientId = path.split('/')[2]; // Assuming /clients/:id
        if (clientId && taskId) {
          navigate(`/clients/${clientId}?openTaskId=${taskId}`, { replace: true });
        }
      }
      // Add more deep linking logic as needed
    };

    handleDeepLink(); // Run once on mount
  }, [navigate, location]);

  return null; // This component doesn't render anything visible
};

export default DeepLinkHandler;