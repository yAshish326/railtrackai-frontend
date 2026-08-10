import api from "./api";

const dashboardService = {
	getSummary() {
		return api.get("/dashboard");
	},
};

export default dashboardService;
