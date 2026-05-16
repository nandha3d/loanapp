<?php
/**
 * Database Connection Test Script for Hostinger
 * This script verifies that the MySQL server is reachable and credentials are correct.
 */

header('Content-Type: text/plain');

// Configuration - matches .env_prod
$host = 'localhost';
$port = 3306;
$dbname = 'u362580417_loanmockup';
$username = 'u362580417_loanmockup';
$password = 'Animazon_Erode11';

echo "--- LoanTrack Database Connection Test ---\n\n";

try {
    echo "Attempting to connect to MySQL...\n";
    echo "Host: $host\n";
    echo "Database: $dbname\n";
    echo "User: $username\n\n";

    $dsn = "mysql:host=$host;port=$port;dbname=$dbname;charset=utf8mb4";
    $options = [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES   => false,
        PDO::ATTR_TIMEOUT            => 5, // 5 seconds timeout
    ];

    $start = microtime(true);
    $pdo = new PDO($dsn, $username, $password, $options);
    $end = microtime(true);

    echo "SUCCESS: Connected to database in " . round(($end - $start) * 1000, 2) . "ms\n\n";

    // Test a simple query
    echo "Testing query execution...\n";
    $stmt = $pdo->query("SELECT COUNT(*) as user_count FROM User");
    $row = $stmt->fetch();
    echo "SUCCESS: Found " . $row['user_count'] . " users in the database.\n\n";

    // Check tables
    echo "Listing tables:\n";
    $stmt = $pdo->query("SHOW TABLES");
    while ($row = $stmt->fetch(PDO::FETCH_NUM)) {
        echo "- " . $row[0] . "\n";
    }

} catch (PDOException $e) {
    echo "ERROR: Connection failed!\n";
    echo "Message: " . $e->getMessage() . "\n";
    echo "Code: " . $e->getCode() . "\n\n";
    
    echo "Troubleshooting Tips:\n";
    echo "1. Verify that 'localhost' is correct for Hostinger (sometimes it requires '127.0.0.1').\n";
    echo "2. Double-check the database name, username, and password in .env_prod.\n";
    echo "3. Ensure the user has been granted all permissions for the database in Hostinger hPanel.\n";
}
