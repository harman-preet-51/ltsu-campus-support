// LTSU Campus Support - Homepage Script

document.addEventListener("DOMContentLoaded", function () {
    const yearElement = document.getElementById("current-year");

    if (yearElement) {
        yearElement.textContent = new Date().getFullYear();
    }

    console.log("LTSU Campus Support Homepage Loaded Successfully");
});
