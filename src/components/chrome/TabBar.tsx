import { Component } from "solid-js";

interface TabBarProps {
  activeTab: string;
  onChange: (tab: string) => void;
}

const TabBar: Component<TabBarProps> = (props) => {
  const tabs = [
    { id: "tasks", label: "任务管理" },
    { id: "health", label: "健康生活" },
  ];

  return (
    <div class="tab-bar">
      {tabs.map((tab) => (
        <button
          classList={{
            "tab-item": true,
            "active": props.activeTab === tab.id,
          }}
          onClick={() => props.onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
};

export default TabBar;