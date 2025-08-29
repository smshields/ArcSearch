# ArcSearch
A tool that allows a user to evaluate over a list of structured JSON files representing game playtraces searching for a specific gameplay "Arc" that best matches a drawing they provide the system.

# Installation
1. Install Node and NPM.
2. Ensure you have a folder that contains a set of structured JSON files (e.g. ./Playtraces/Playtrace1/Playtrace1.JSON).
3. Open a terminal session and navigate to the root folder of this project.
4. Run the command "npm run dev". You should see a server start up with a link to a localhost IP address.
5. Open the address in your web-browser.

# Usage
1. Select the folder containing your playtraces in the dropdown menu.
2. Select the X- and Y-Axis for your playtrace visualization.
3. You may optionally enable a pointcloud for your dataset using the toggle on the right-hand side of the tool.
4. Draw the curve you are searching for using the canvas on the right-hand side of the tool.
4. Select your search strategy - Frechet will look for overall trends, while DTW will look for features (but potentially can be out of phase)
5. Click the search button to see your results.
6. Results are listed from highest to lowest score and are color coded from green to red, respectively. 
7. Clicking on an individual playtrace score will show you the specific trace and the curve you drew in a single view.
8. You can inspect specific playtrace data entries along the playtrace curve.

# Acknowledgements
Development on this project was done in part using an LLM - Google Gemini 2.5 Pro. 
