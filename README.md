Part 1

1. Implementation uses an arraylist to store control points, can handle more than 20 
2. Parsing is implemented in lines 295-344, and adding and updating points in lines 60-80
3. Arc length is calculated by storing the arc length values for each point in a table, can be seen in lines 105-120
4. Loading and Exporting are implemented in lines 353-384
5. Drawing is implemented using the update_scene function in lines 346-351, which uses get_position as the curve function. get_position is implemented in lines 87-102

Test code I used:  
add point 0.0 5.0 0.0 -20.0 0.0 20.0  
add point 0.0 5.0 5.0 20.0 0.0 20.0  
add point 5.0 5.0 5.0 20.0 0.0 -20.0    
add point 5.0 5.0 0.0 -20.0 0.0 -20.0   
add point 0.0 5.0 0.0 -20.0 0.0 20.0  
get_arc_length  

add point 0.0 4.0 0.0 -12.0 -3.0 12.0  
add point 0.0 3.0 4.0 9.0 -3.0 9.0  
add point 3.0 2.0 4.0 9.0 -3.0 -9.0  
add point 3.0 1.0 0.0 -12.0 -3.0 -12.0  

5  
0.0 5.0 0.0 -20.0 0.0 20.0  
0.0 5.0 5.0 20.0 0.0 20.0  
5.0 5.0 5.0 20.0 0.0 -20.0  
5.0 5.0 0.0 -20.0 0.0 -20.0  
0.0 5.0 0.0 -20.0 0.0 20.0  

add point 0.0 5.0 0.0 -20.0 0.0 20.0  
add point 0.0 5.0 5.0 20.0 0.0 20.0  
add point 5.0 5.0 5.0 20.0 0.0 -20.0  
add point 5.0 5.0 0.0 -20.0 0.0 -20.0  
add point 0.0 5.0 0.0 -20.0 0.0 20.0  
set point 1 0 0 0  
set tangent 2 5 5 5  
get_arc_length  

Part 2

1. Particle System implemented in lines 8 - 113
2. Script-based commands implemented lines 318-410
3. Forward euler implemented lines 22 - 26
4. Symplectic euler implemented lines 27-31
5. Verlet implemented lines 32-36
6. Ground and gravity implmeneted lines 88 - 102
7. Particle and spring drawing implemnted lines 255-280

Part 3

1. The hermite spline trajectory can be seen in the animation, and the top particle always follows it. Code implementation is just rehashed from part one, but sine function is in line 348
2. Chain simulation can be seen in animation, as long as bottom particles hitting the ground. Once again, reused code from part 2 and particles are hard-coded.
3. Can be seen in animation.